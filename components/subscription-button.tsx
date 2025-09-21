// components/subscription-button.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

interface SubscriptionButtonProps {
  isPremium: boolean;
}

export const SubscriptionButton = ({ 
  isPremium = false 
}: SubscriptionButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  
  const onClick = async () => {
    try {
      setLoading(true);
      
      // Double-check authentication state before proceeding
      if (!isSignedIn) {
        toast.error("Please sign in to continue");
        // Optionally redirect to sign-in
        window.location.href = "/sign-in?redirect_url=/settings";
        return;
      }
      
      const response = await axios.get("/api/stripe", {
        withCredentials: true, // Ensure cookies are sent
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.data.url) {
        // Store current auth state before redirect
        sessionStorage.setItem('stripe_redirect', 'true');
        sessionStorage.setItem('stripe_redirect_time', Date.now().toString());
        
        // Use standard navigation
        window.location.href = response.data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      
      // More specific error messages
      if (error.response?.status === 401) {
        toast.error("Authentication required. Please sign in again.");
        window.location.href = "/sign-in?redirect_url=/settings";
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      
      setLoading(false);
    }
  }
  
  // Don't render until auth is loaded
  if (!isLoaded) {
    return (
      <Button disabled size="sm" variant="default" className="min-w-[140px]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }
  
  return (
    <Button 
      disabled={loading || !isSignedIn} 
      onClick={onClick}
      size="sm"
      variant={isPremium ? "default": "premium"}
      className="min-w-[140px]"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          {isPremium ? "Manage Subscription" : "Upgrade"}
          {!isPremium && <Sparkles className="h-4 ml-2 fill-white"/>}
        </>
      )}
    </Button>
  );
};