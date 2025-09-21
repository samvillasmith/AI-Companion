// app/(root)/(routes)/settings/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { SubscriptionButton } from "@/components/subscription-button";

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();

  // Keep loading = true until Clerk is ready AND we have fetched status.
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const ready = useMemo(() => isLoaded && isSignedIn, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!ready) return; // do nothing until Clerk is ready

    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscription/status", {
          cache: "no-store",
          credentials: "include",
        });
        const data = res.ok ? await res.json() : { isPremium: false };
        if (!canceled) {
          setIsPremium(!!data?.isPremium);
        }
      } catch {
        if (!canceled) {
          // If the check fails, fall back to showing "Upgrade"
          setIsPremium(false);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [ready]);

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Companions
      </Link>

      <div className="space-y-2 mt-4">
        <h3 className="text-lg font-medium">Settings</h3>

        {/* Only show the descriptive line after we know the status */}
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Checking your subscription…
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {isPremium
              ? "You are currently on a Premium plan."
              : "You are currently on a free plan."}
          </div>
        )}
      </div>

      <div className="mt-4">
        {/* IMPORTANT: Don't render the button until loading is done */}
        {loading ? (
          <div
            aria-hidden
            className="h-9 w-48 rounded-md bg-muted animate-pulse"
          />
        ) : (
          <SubscriptionButton isPremium={isPremium} />
        )}
      </div>
    </div>
  );
}
