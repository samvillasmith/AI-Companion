// app/(root)/(routes)/layout.tsx
import ShellLayout from "@/components/shell-layout";
import { checkSubscription } from "@/lib/subscription";
import { auth, currentUser } from "@clerk/nextjs/server";

// Ensure fresh auth/subscription after Stripe/Clerk returns
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: authUserId } = await auth();
  let userId = authUserId;
  if (!userId) {
    const user = await currentUser();
    userId = user?.id ?? null;
  }

  const isPremium = userId ? await checkSubscription() : false;

  return <ShellLayout isPremium={isPremium}>{children}</ShellLayout>;
}
