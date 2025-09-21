// app/payment/success/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function PaymentSuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!isLoaded) return;

    const confirmPayment = async () => {
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        console.error("No session_id in URL");
        setStatus("error");
        toast.error("Invalid payment session");
        router.push("/settings");
        return;
      }

      // Check if user is signed in
      if (!isSignedIn) {
        console.error("User not signed in after Stripe redirect");
        // Store the session ID and redirect to sign-in
        sessionStorage.setItem("pending_stripe_session", sessionId);
        router.push(`/sign-in?redirect_url=/payment/success?session_id=${sessionId}`);
        return;
      }

      try {
        // Call the confirmation endpoint
        const response = await fetch(`/api/stripe/confirm-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Confirmation failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setStatus("success");
          toast.success("Welcome to Premium! 🎉", {
            description: "Your subscription is now active.",
            duration: 5000,
          });
          
          // Clear any session storage flags
          sessionStorage.removeItem("stripe_redirect");
          sessionStorage.removeItem("stripe_redirect_time");
          sessionStorage.removeItem("pending_stripe_session");
          
          // Redirect to home with success params
          setTimeout(() => {
            router.push("/?upgraded=true&success=true");
          }, 1500);
        } else {
          throw new Error(data.error || "Confirmation failed");
        }
      } catch (error) {
        console.error("Payment confirmation error:", error);
        setStatus("error");
        toast.error("Failed to confirm payment", {
          description: "Please contact support if you were charged.",
        });
        setTimeout(() => {
          router.push("/settings");
        }, 2000);
      }
    };

    confirmPayment();
  }, [isLoaded, isSignedIn, searchParams, router]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Confirming your payment...</h2>
        <p className="text-muted-foreground">Please wait while we activate your subscription.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">Welcome to Premium!</h2>
        <p className="text-muted-foreground">Your subscription is now active. Redirecting...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">❌</div>
        <h2 className="text-2xl font-bold">Payment Confirmation Failed</h2>
        <p className="text-muted-foreground">Please contact support if you were charged.</p>
        <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
      </div>
    );
  }

  return null;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      }
    >
      <PaymentSuccessInner />
    </Suspense>
  );
}