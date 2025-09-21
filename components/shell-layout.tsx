// components/shell-layout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

const HIDE_ON: RegExp[] = [
  /^\/sign-in(\/|$)/,
  /^\/sign-up(\/|$)/,
  /^\/first-run(\/|$)/,
  /^\/payment(\/|$)/,
];

async function fetchPremium(): Promise<boolean> {
  try {
    const res = await fetch("/api/subscription/status", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.isPremium;
  } catch {
    return false;
  }
}

export default function ShellLayout({
  children,
  isPremium: serverIsPremium,
}: {
  children: React.ReactNode;
  isPremium: boolean;
}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const paramsKey = searchParams?.toString() ?? "";
  const hideChrome = useMemo(() => HIDE_ON.some((re) => re.test(pathname)), [pathname]);

  const { isLoaded, isSignedIn } = useAuth();
  const [clientIsPremium, setClientIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!isLoaded || !isSignedIn) {
        setClientIsPremium(null);
        return;
      }
      const val = await fetchPremium();
      if (active) setClientIsPremium(val);
    }
    run();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, pathname, paramsKey]);

  if (hideChrome) {
    return <>{children}</>;
  }

  const premiumResolved =
    clientIsPremium !== null ? clientIsPremium : serverIsPremium ? true : null;

  if (isSignedIn && premiumResolved === null) {
    // Minimal skeleton while premium resolves on the client
    return (
      <div className="h-full">
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/50 backdrop-blur-md border-b" />
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 bg-background/50 border-r" />
        <main id="main-content" className="pt-16 md:pl-20 min-w-0">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
            {children}
          </div>
        </main>
      </div>
    );
  }

  const effectivePremium =
    premiumResolved === null ? !!serverIsPremium : premiumResolved;

  return (
    <div className="h-full">
      <header className="fixed top-0 left-0 right-0 z-50">
        <Navbar isPremium={effectivePremium} />
      </header>

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 flex-col bg-background">
        <Sidebar isPremium={effectivePremium} />
      </aside>

      <main id="main-content" className="pt-16 md:pl-20 min-w-0">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
