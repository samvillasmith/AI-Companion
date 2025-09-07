// components/subscription-button.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionButtonProps {
  isPremium: boolean;
}

export const SubscriptionButton = ({ 
  isPremium = false 
}: SubscriptionButtonProps) => {
  const [loading, setLoading] = useState(false);
  
  const onClick = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get("/api/stripe", {
        withCredentials: true, // Ensure cookies are sent
      });
      
      if (response.data.url) {
        // Use standard navigation instead of replace
        window.location.href = response.data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }
  
  return (
    <Button 
      disabled={loading} 
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