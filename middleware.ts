// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only these routes are truly public (no auth needed)
const isPublicRoute = createRouteMatcher([
  '/sign-up(.*)',
  '/sign-in(.*)',
  '/api/webhook', // Stripe webhooks need to be public
])

export default clerkMiddleware(async (auth: { protect: () => any }, req: any) => {
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