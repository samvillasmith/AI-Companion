// app/(dashboard)/layout.tsx
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth } from "@clerk/nextjs/server";
import React from "react";

// Centers sign-in when logged out. When logged in, shows navbar + left rail.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const isPremium = userId ? await checkSubscription() : false;

  // Logged out (e.g., /sign-in): dead-center, no borders
  if (!userId) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <main id="main-content" className="w-full max-w-md px-4 sm:px-6">
          {children}
        </main>
      </div>
    );
  }

  // Logged in app layout
  return (
    <div className="min-h-screen">
      <Navbar isPremium={isPremium} />

      {/* Left sidebar below navbar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 flex-col bg-background">
        <Sidebar isPremium={isPremium} />
      </aside>

      {/* Main content — IMPORTANT: min-w-0 prevents clipping after navigation */}
      <main id="main-content" className="pt-16 md:pl-20 min-w-0">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
