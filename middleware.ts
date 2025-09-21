/* eslint-disable @typescript-eslint/no-unused-vars */
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only these routes are truly public (no auth needed)
const isPublicRoute = createRouteMatcher([
  '/sign-up(.*)',
  '/sign-in(.*)',
  '/api/webhook', // Stripe webhooks need to be public
  '/api/stripe/confirm-payment', // Allow this to handle its own auth
])

export default clerkMiddleware(async (auth, req) => {
  // Don't aggressively protect routes when coming back from Stripe
  const url = new URL(req.url);
  const isComingFromStripe = url.searchParams.has('session_id') || 
                             url.searchParams.has('upgraded') ||
                             req.headers.get('referer')?.includes('stripe.com');
  
  // For public routes, skip protection
  if (isPublicRoute(req)) {
    return;
  }
  
  // If coming from Stripe, be lenient with auth protection
  // This prevents the redirect loops
  if (isComingFromStripe) {
    try {
      await auth.protect();
    } catch (error) {
      // Silently continue - let the page handle auth state
      console.log('[Middleware] Allowing Stripe return through despite auth issue');
      return;
    }
  } else {
    // Normal protection for other routes
    await auth.protect();
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