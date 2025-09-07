import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth } from "@clerk/nextjs/server";

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const { userId } = await auth();
  const isPremium = userId ? await checkSubscription() : false;

  // Background accents (light + dark)
  const Background = () => (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Light mode: soft pastel wash */}
      <div className="block dark:hidden absolute inset-0 opacity-60 bg-[radial-gradient(1000px_700px_at_50%_-10%,rgba(99,102,241,0.08),transparent_70%)]" />
      <div className="block dark:hidden absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-70 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(99,102,241,0.06),rgba(217,70,239,0.06),rgba(236,72,153,0.06),rgba(99,102,241,0.06))]" />
      {/* Dark mode: your stronger glow */}
      <div className="hidden dark:block absolute inset-0 opacity-80 bg-[radial-gradient(1200px_800px_at_50%_-10%,rgba(59,130,246,0.20),transparent_70%)]" />
      <div className="hidden dark:block absolute inset-0 mix-blend-screen opacity-70 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(99,102,241,0.18),rgba(217,70,239,0.18),rgba(236,72,153,0.18),rgba(99,102,241,0.18))]" />
    </div>
  );

  if (!userId) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <Background />
        <main id="main-content" className="grid min-h-screen place-items-center px-4">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    );
  }

  return (
  <div className="min-h-screen">
    <Navbar isPremium={isPremium} />

    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 mt-16 w-20 flex-col bg-background">
      <Sidebar isPremium={isPremium} />
    </aside>

    {/* 👇 allow children to grow horizontally */}
    <main id="main-content" className="pt-16 md:pl-20 min-w-0">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-w-0">
        {children}
      </div>
    </main>
  </div>
  );
}

export default RootLayout;
