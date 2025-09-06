// lib/subscription.ts
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";

const DAY_IN_MILLISECONDS = 86_400_000;

export const checkSubscription = async () => {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.log("❌ No userId found - user not authenticated");
      return false;
    }

    const userSubscription = await prismadb.userSubscription.findUnique({
      where: {
        userId: userId
      },
      select: {
        stripeCurrentPeriodEnd: true,
        stripeCustomerId: true,
        stripePriceId: true,
        stripeSubscriptionId: true
      }
    });

    if (!userSubscription) {
      console.log("❌ No subscription found for user:", userId);
      return false;
    }

    // Debug logging
    console.log("🔍 Subscription data:", {
      userId,
      stripePriceId: userSubscription.stripePriceId,
      stripeSubscriptionId: userSubscription.stripeSubscriptionId,
      stripeCurrentPeriodEnd: userSubscription.stripeCurrentPeriodEnd,
    });

    const endMs = userSubscription.stripeCurrentPeriodEnd?.getTime();
    const now = Date.now();
    
    // Debug time comparison
    if (endMs) {
      console.log("⏰ Time check:", {
        currentTime: new Date(now).toISOString(),
        subscriptionEnd: new Date(endMs).toISOString(),
        msUntilExpiry: endMs - now,
        hoursUntilExpiry: (endMs - now) / (1000 * 60 * 60),
      });
    }
    
    // Check if subscription is valid
    // A subscription is valid if:
    // 1. It has a price ID (active subscription)
    // 2. It has an end date
    // 3. The end date hasn't passed yet (with grace period)
    const isValid = 
      !!userSubscription.stripePriceId && 
      !!userSubscription.stripeSubscriptionId &&
      endMs != null && 
      endMs + DAY_IN_MILLISECONDS > now; // Add 1 day grace period

    console.log(`✅ Subscription valid: ${isValid}`);
    
    return isValid;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}