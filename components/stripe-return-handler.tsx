// components/stripe-return-handler.tsx
"use client";

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

export function StripeReturnHandler() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if we're coming back from Stripe
    const isStripeReturn = searchParams.has('session_id') || 
                          searchParams.has('upgraded') ||
                          sessionStorage.getItem('stripe_redirect') === 'true';

    if (!isStripeReturn) {
      return; // Not a Stripe return, do nothing
    }

    console.log('[StripeReturnHandler] Detected Stripe return');

    // If auth is loaded and we're not signed in, we have a problem
    if (isLoaded && !isSignedIn) {
      console.log('[StripeReturnHandler] Auth loaded but not signed in, attempting recovery');
      
      // Clear problematic session storage
      const keysToCheck = [
        'stripe_redirect',
        'stripe_redirect_time',
        'stripe_redirect_user',
        '__clerk_db_jwt',
        '__clerk_client_jwt',
      ];
      
      keysToCheck.forEach(key => {
        const value = sessionStorage.getItem(key);
        if (value) {
          console.log(`[StripeReturnHandler] Clearing ${key}`);
          sessionStorage.removeItem(key);
        }
      });

      // Force a hard refresh to reset auth state
      const currentUrl = window.location.href;
      
      // Remove Stripe params from URL to prevent loops
      const cleanUrl = new URL(currentUrl);
      cleanUrl.searchParams.delete('session_id');
      cleanUrl.searchParams.delete('upgraded');
      cleanUrl.searchParams.delete('success');
      
      // Use replace to avoid back button issues
      window.location.replace(cleanUrl.toString());
    } else if (isLoaded && isSignedIn) {
      // We're signed in, clean up the URL
      console.log('[StripeReturnHandler] Signed in successfully, cleaning URL');
      
      // Clear Stripe flags
      sessionStorage.removeItem('stripe_redirect');
      sessionStorage.removeItem('stripe_redirect_time');
      sessionStorage.removeItem('stripe_redirect_user');
      
      // Clean the URL without a full page reload if possible
      const cleanUrl = new URL(window.location.href);
      const hadParams = cleanUrl.searchParams.has('session_id') || 
                       cleanUrl.searchParams.has('upgraded') ||
                       cleanUrl.searchParams.has('success');
      
      if (hadParams) {
        cleanUrl.searchParams.delete('session_id');
        cleanUrl.searchParams.delete('upgraded'); 
        cleanUrl.searchParams.delete('success');
        
        // Use replaceState to update URL without reload
        window.history.replaceState({}, '', cleanUrl.toString());
      }
    }
  }, [isLoaded, isSignedIn, pathname, searchParams, router]);

  return null; // This component doesn't render anything
}