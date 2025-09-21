/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function FirstRunPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-3">
            <h1 className="text-2xl font-semibold">Please stand by…</h1>
            <p className="text-muted-foreground">
              Please stand by while we create your account
            </p>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </main>
      }
    >
      <FirstRunInner />
    </Suspense>
  );
}

function FirstRunInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();

  const next = params.get("next") ?? "/";

  useEffect(() => {
    // Mark first run as complete in user metadata
    if (user && !user.unsafeMetadata?.firstRunHandled) {
      user
        .update({
          unsafeMetadata: {
            ...(user.unsafeMetadata as any),
            firstRunHandled: true,
          },
        })
        .catch(console.error);
    }

    const t = setTimeout(() => {
      router.replace(next);
    }, 5000);

    return () => clearTimeout(t);
  }, [next, router, user]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-3">
        <h1 className="text-2xl font-semibold">Please stand by…</h1>
        <p className="text-muted-foreground">
          Please stand by while we create your account
        </p>
        <p className="text-sm text-muted-foreground">Redirecting shortly…</p>
      </div>
    </main>
  );
}
