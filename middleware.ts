// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes incl. Clerk + Stripe return flows + subscription status
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/first-run(.*)",
  "/sso-callback(.*)",
  "/.well-known(.*)",
  "/_clerk(.*)",
  "/api/webhook(.*)",
  "/api/stripe(.*)",              // includes confirm & confirm-payment
  "/api/subscription(.*)",        // allow status checks while Clerk is handshaking
  "/payment/success(.*)",
]);

// Soft-protected routes (don’t redirect-loop if auth transiently missing)
const isSoftProtected = createRouteMatcher(["/settings(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Canonical host enforcement (prevents cookie/domain bounces)
  const canonicalHost = process.env.NEXT_PUBLIC_CANONICAL_HOST;
  const isProd = process.env.VERCEL_ENV === "production";
  const currentHost = req.headers.get("host");
  if (isProd && canonicalHost && currentHost && currentHost !== canonicalHost) {
    const url = new URL(req.url);
    url.host = canonicalHost;
    return NextResponse.redirect(url, 308);
  }

  const { userId } = await auth();

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  if (isSoftProtected(req) && userId == null) {
    return NextResponse.next();
  }

  await auth.protect();
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/(api|trpc)(.*)"
  ],
};
