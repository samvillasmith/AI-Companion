// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook',
  '/api/stripe/confirm-payment',
])

// Routes that should be accessible even with unclear auth state
const isProtectedButFlexible = createRouteMatcher([
  '/settings',
  '/payment/success',
  '/',
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = new URL(req.url);
  
  // Detect Stripe-related navigation
  const stripeIndicators = {
    hasSessionId: url.searchParams.has('session_id'),
    hasUpgraded: url.searchParams.has('upgraded'),
    hasSuccess: url.searchParams.has('success'),
    fromStripe: req.headers.get('referer')?.includes('stripe.com') === true,
    fromBilling: req.headers.get('referer')?.includes('billing.stripe.com') === true,
  };
  
  const isStripeRelated = Object.values(stripeIndicators).some(v => v);
  
  // Log for debugging
  if (isStripeRelated) {
    console.log('[Middleware] Stripe-related request detected:', {
      path: url.pathname,
      ...stripeIndicators
    });
  }
  
  // For public routes, don't protect
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  
  // For Stripe returns on flexible routes, try to protect but don't fail hard
  if (isStripeRelated && isProtectedButFlexible(req)) {
    try {
      // Try to get the user but don't block if it fails
      const { userId } = await auth();
      if (!userId) {
        console.log('[Middleware] No userId on Stripe return, allowing through anyway');
        // Don't redirect, just let it through
        // The page itself will handle the auth state
        return NextResponse.next();
      }
    } catch (error) {
      console.log('[Middleware] Auth error on Stripe return, allowing through:', error);
      return NextResponse.next();
    }
    
    return NextResponse.next();
  }
  
  // For all other routes, normal protection
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}