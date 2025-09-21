import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth, currentUser } from "@clerk/nextjs/server";

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  // Try auth() first
  const { userId: authUserId } = await auth();
  
  // If auth() returns null (which can happen during Stripe redirect back),
  // try currentUser() as a fallback
  let userId = authUserId;
  if (!userId) {
    const user = await currentUser();
    userId = user?.id ?? null;
  }
  
  const isPremium = userId ? await checkSubscription() : false;

  // Background accents (light + dark)
  const Background = () => (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Light mode: soft pastel wash */}
      <div className="block dark:hidden absolute inset-0 opacity-60 bg-[radial-gradient(1000px_700px_at_50%_-10%,rgba(99,102,241,0.08),transparent_70%)]" />
      <div className="block dark:hidden absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-70 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(99,102,241,0.06),rgba(217,70,239,0.06),rgba(236,72,153,0.06),rgba(99,102,241,0.06))]" />
      {/* Dark mode: stronger glow */}
      <div className="hidden dark:block absolute inset-0 opacity-80 bg-[radial-gradient(1200px_800px_at_50%_-10%,rgba(59,130,246,0.20),transparent_70%)]" />
      <div className="hidden dark:block absolute inset-0 mix-blend-screen opacity-70 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(99,102,241,0.18),rgba(217,70,239,0.18),rgba(236,72,153,0.18),rgba(99,102,241,0.18))]" />
    </div>
  );

  // 🔓 Logged-out: let the sign-in page own layout (no grid/px/max-w wrappers)
  if (!userId) {
    return (
      <div className="relative min-h-[100svh] bg-background text-foreground overflow-hidden">
        <Background />
        {children}
      </div>
    );
  }

  // 🔒 Logged-in app shell - ALWAYS show navbar and sidebar if userId exists
  return (
    <div className="min-h-[100svh]">
      <Navbar isPremium={isPremium} />

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 flex-col bg-background">
        <Sidebar isPremium={isPremium} />
      </aside>

      {/* allow children to grow horizontally */}
      <main id="main-content" className="pt-16 md:pl-20 min-w-0">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default RootLayout;