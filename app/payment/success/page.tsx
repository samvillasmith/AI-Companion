// app/payment/success/page.tsx
"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function PaymentSuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  // loading = waiting for sessionId / confirming
  // success = confirmed
  // error = real failure from API / missing session after we've had a chance to load
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const ran = useRef(false);

  // Prefer explicit session_id; fall back to checkout_session_id if present
  const sessionId =
    searchParams.get("session_id") ||
    searchParams.get("checkout_session_id") ||
    null;

  useEffect(() => {
    // Avoid duplicate runs if the component remounts
    if (ran.current) return;
    if (!isLoaded) return;

    // IMPORTANT: Do NOT mark error if sessionId isn't here yet.
    // App Router can hydrate params asynchronously; keep showing the spinner.
    if (!sessionId) return;

    // If user isn't signed in yet (rare race after Stripe return), store session and go sign in.
    if (!isSignedIn) {
      sessionStorage.setItem("pending_stripe_session", sessionId);
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent(
          `/payment/success?session_id=${sessionId}`
        )}`
      );
      return;
    }

    ran.current = true;

    (async () => {
      try {
        const response = await fetch(`/api/stripe/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Confirmation failed: ${response.status}`);
        }

        const data = await response.json();
        if (data?.success) {
          setStatus("success");
          toast.success("Welcome to Premium! 🎉", {
            description: "Your subscription is now active.",
          });

          // Clean up URL and take user home
          setTimeout(() => {
            router.replace("/?upgraded=true&success=true");
          }, 800);
        } else {
          throw new Error(data?.error || "Confirmation failed");
        }
      } catch (err) {
        console.error("Payment confirmation error:", err);
        setStatus("error");
        toast.error("Failed to confirm payment", {
          description: "Please contact support if you were charged.",
        });
        setTimeout(() => {
          router.replace("/settings");
        }, 1500);
      }
    })();
  }, [isLoaded, isSignedIn, sessionId, router]);

  // Keep spinner visible while waiting for sessionId or confirmation.
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Confirming your payment...</h2>
        <p className="text-muted-foreground">
          Please wait while we activate your subscription.
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">Welcome to Premium!</h2>
        <p className="text-muted-foreground">
          Your subscription is now active. Redirecting...
        </p>
      </div>
    );
  }

  // status === "error"
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="text-6xl">❌</div>
      <h2 className="text-2xl font-bold">Payment Confirmation Failed</h2>
      <p className="text-muted-foreground">
        Please contact support if you were charged.
      </p>
      <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
    </div>
  );
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
