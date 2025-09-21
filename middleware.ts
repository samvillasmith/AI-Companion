// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes incl. Clerk + Stripe return flows (avoid protecting handshakes)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/first-run(.*)",
  "/sso-callback(.*)",
  "/.well-known(.*)",
  "/_clerk(.*)",                  // Clerk internal endpoints
  "/api/webhook(.*)",
  "/api/stripe(.*)",              // includes /confirm & /confirm-payment
  "/payment/success(.*)",
]);

// (Optional) allow settings during uncertain auth state (e.g., just after Stripe)
const isSoftProtected = createRouteMatcher(["/settings(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Enforce a single host in production to avoid cookie/domain flips (loops)
  // Set NEXT_PUBLIC_CANONICAL_HOST=www.telmii.online in prod env.
  const canonicalHost = process.env.NEXT_PUBLIC_CANONICAL_HOST;
  const isProd = process.env.VERCEL_ENV === "production";
  const currentHost = req.headers.get("host");
  if (isProd && canonicalHost && currentHost && currentHost !== canonicalHost) {
    const url = new URL(req.url);
    url.host = canonicalHost;
    return NextResponse.redirect(url, 308);
  }

  const { userId } = await auth();

  // Always let public routes through
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // During short handshake windows Clerk can’t determine auth yet.
  // Don’t redirect-loop: let soft-protected routes pass.
  if (isSoftProtected(req) && userId == null) {
    return NextResponse.next();
  }

  // Everything else is protected.
  await auth.protect();
  return NextResponse.next();
});

// Match all app + API routes, excluding static assets
export const config = {
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
