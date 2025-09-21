// components/session-guardian.tsx
"use client";

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function SessionGuardian() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) return;

    // Check if we're returning from Stripe
    const upgraded = searchParams.get('upgraded');
    const success = searchParams.get('success');
    
    if (upgraded === 'true' && success === 'true') {
      // Clear any stale session storage
      sessionStorage.removeItem('stripe_redirect');
      sessionStorage.removeItem('stripe_redirect_time');
      
      // Verify we're still authenticated
      if (!isSignedIn) {
        console.error('User not authenticated after Stripe redirect!');
        toast.error('Session expired. Please sign in again.');
        router.push('/sign-in?redirect_url=/');
        return;
      }
      
      // Success - user is authenticated and upgraded
      toast.success('Welcome to Premium! 🎉', {
        description: `Thank you for upgrading, ${user?.firstName || 'friend'}!`,
        duration: 5000,
      });
      
      // Clean URL after showing toast
      setTimeout(() => {
        router.replace('/');
      }, 1000);
    }

    // Check for stripe redirect flag
    const stripeRedirect = sessionStorage.getItem('stripe_redirect');
    if (stripeRedirect === 'true') {
      const redirectTime = parseInt(sessionStorage.getItem('stripe_redirect_time') || '0');
      const timeSince = Date.now() - redirectTime;
      
      // If more than 30 minutes passed, clear the flag
      if (timeSince > 30 * 60 * 1000) {
        sessionStorage.removeItem('stripe_redirect');
        sessionStorage.removeItem('stripe_redirect_time');
      }
    }

    // Monitor for auth state changes
    const checkInterval = setInterval(() => {
      if (!document.hidden && isLoaded && !isSignedIn) {
        const path = window.location.pathname;
        // Don't redirect if already on auth pages
        if (!path.startsWith('/sign-in') && !path.startsWith('/sign-up')) {
          console.warn('Auth state lost, redirecting to sign-in');
          clearInterval(checkInterval);
          router.push('/sign-in?redirect_url=' + encodeURIComponent(path));
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, [isLoaded, isSignedIn, user, searchParams, router]);

  return null;
}