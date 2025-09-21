// app/(root)/layout.tsx
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth, currentUser } from "@clerk/nextjs/server";

// Force this segment to always be rendered dynamically so auth/subscription
// re-evaluates after token refresh or any client-side nav.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Try auth() first; fall back to currentUser() during transient handshake states.
  const { userId: authUserId } = await auth();
  let userId = authUserId;
  if (!userId) {
    const user = await currentUser();
    userId = user?.id ?? null;
  }

  const isPremium = userId ? await checkSubscription() : false;

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
