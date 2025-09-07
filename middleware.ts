// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-up(.*)',
  '/sign-in(.*)',
  '/api/webhook',
  '/api/stripe',
  '/',  // Add root as public
])

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for Stripe return URLs to prevent redirect loops
  const url = new URL(req.url);
  
  // If coming back from Stripe (has session_id or other Stripe params)
  if (url.pathname === '/settings' && 
      (url.searchParams.has('session_id') || 
       url.searchParams.has('success') ||
       url.searchParams.has('canceled'))) {
    // Let it through without auth check temporarily
    return;
  }
  
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