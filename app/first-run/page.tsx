"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function FirstRunPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(next);
    }, 5000);
    return () => clearTimeout(t);
  }, [next, router]);

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
