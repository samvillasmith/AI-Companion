// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Only these routes are truly public (no auth needed)
const isPublicRoute = createRouteMatcher([
  '/sign-up(.*)',
  '/sign-in(.*)',
  '/api/webhook', // Stripe webhooks need to be public
])

export default clerkMiddleware(async (auth, req) => {
  // Special handling for stripe confirm
  if (req.nextUrl.pathname === '/api/stripe/confirm') {
    // This route MUST have an authenticated user
    const { userId } = await auth();
    if (!userId) {
      // Redirect to sign-in with return URL
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', '/settings');
      return NextResponse.redirect(signInUrl);
    }
    // Continue with authenticated user
    return;
  }
  
  // For all non-public routes, require authentication
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}