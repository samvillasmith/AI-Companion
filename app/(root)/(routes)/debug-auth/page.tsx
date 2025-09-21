// app/(root)/(routes)/debug-auth/page.tsx
import { currentUser, auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
// Only enable this in development
const isDev = process.env.NODE_ENV === "development";

export default async function AuthDebugPage() {
  if (!isDev) {
    redirect("/");
  }

  const { userId } = await auth();
  const user = await currentUser();
  
  let subscription = null;
  if (userId) {
    subscription = await prismadb.userSubscription.findUnique({
      where: { userId }
    });
  }

  const now = new Date();
  const isSubscriptionActive = subscription && 
    subscription.stripeCurrentPeriodEnd && 
    subscription.stripeCurrentPeriodEnd > now;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Auth Debug Info (Dev Only)</h1>
      
      <div className="border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">Authentication Status</h2>
        <div className="text-sm space-y-1">
          <div>User ID: {userId || "Not authenticated"}</div>
          <div>Email: {user?.emailAddresses?.[0]?.emailAddress || "N/A"}</div>
          <div>Name: {user?.firstName} {user?.lastName}</div>
          <div>Created: {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"}</div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">Subscription Status</h2>
        {subscription ? (
          <div className="text-sm space-y-1">
            <div>Stripe Customer ID: {subscription.stripeCustomerId}</div>
            <div>Subscription ID: {subscription.stripeSubscriptionId}</div>
            <div>Price ID: {subscription.stripePriceId}</div>
            <div>Period End: {subscription.stripeCurrentPeriodEnd?.toLocaleString()}</div>
            <div className={`font-semibold ${isSubscriptionActive ? "text-green-600" : "text-red-600"}`}>
              Status: {isSubscriptionActive ? "ACTIVE" : "INACTIVE/EXPIRED"}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No subscription found</div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">Session Storage Check</h2>
        <div className="text-sm">
          <code>
            {`// Run this in browser console:
console.log({
  stripeRedirect: sessionStorage.getItem('stripe_redirect'),
  redirectTime: sessionStorage.getItem('stripe_redirect_time'),
  timeSince: Date.now() - parseInt(sessionStorage.getItem('stripe_redirect_time') || '0')
});`}
          </code>
        </div>
      </div>

      <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
        <h2 className="font-semibold text-orange-800 dark:text-orange-200">Debug Actions</h2>
        <div className="mt-2 space-x-2">
          <Link href="/sign-in" className="text-sm underline">Sign In Page</Link>
          <Link href="/sign-in" className="text-sm underline">Sign In Page</Link>
          <Link href="/settings" className="text-sm underline">Settings</Link>
        </div>
      </div>
    </div> 
  );
}