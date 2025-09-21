// components/shell-layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

const HIDE_ON: RegExp[] = [
  /^\/sign-in(\/|$)/,
  /^\/sign-up(\/|$)/,
  /^\/first-run(\/|$)/,
  /^\/payment(\/|$)/, // e.g. /payment/success, any return state
];

export default function ShellLayout({
  children,
  isPremium,
}: {
  children: React.ReactNode;
  isPremium: boolean;
}) {
  const pathname = usePathname() || "/";
  const hideChrome = HIDE_ON.some((re) => re.test(pathname));

  if (hideChrome) {
    // No navbar/sidebar on auth & payment return pages
    return <>{children}</>;
  }

  return (
    <div className="h-full">
      <header className="fixed top-0 left-0 right-0 z-50">
        <Navbar isPremium={isPremium} />
      </header>

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 flex-col bg-background">
        <Sidebar isPremium={isPremium} />
      </aside>

      <main id="main-content" className="pt-16 md:pl-20 min-w-0">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
