// app/api/stripe/confirm-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null;
};

function toDate(sec?: number | null) {
  return typeof sec === "number" ? new Date(sec * 1000) : null;
}

export async function POST(req: NextRequest) {
  try {
    // Verify the current user is authenticated
    const user = await currentUser();
    if (!user) {
      console.error("[CONFIRM_PAYMENT] No authenticated user");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing session ID" },
        { status: 400 }
      );
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify session is valid
    if (session.mode !== "subscription") {
      return NextResponse.json(
        { success: false, error: "Invalid session mode" },
        { status: 400 }
      );
    }

    const isPaid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      !!session.subscription;

    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "Session not paid" },
        { status: 400 }
      );
    }

    const sessionUserId = session.metadata?.userId;
    const subscriptionId = session.subscription as string | undefined;

    if (!sessionUserId || !subscriptionId) {
      console.warn("[CONFIRM_PAYMENT] Missing metadata", {
        sessionUserId,
        subscriptionId,
      });
      return NextResponse.json(
        { success: false, error: "Missing session metadata" },
        { status: 400 }
      );
    }

    // CRITICAL: Verify the session belongs to the authenticated user
    if (sessionUserId !== user.id) {
      console.error("[CONFIRM_PAYMENT] User ID mismatch!", {
        sessionUserId,
        authenticatedUserId: user.id,
      });
      return NextResponse.json(
        { success: false, error: "Session user mismatch" },
        { status: 403 }
      );
    }

    // Check if subscription already exists (idempotency)
    const existingSubscription = await prismadb.userSubscription.findUnique({
      where: { userId: user.id }
    });

    if (existingSubscription?.stripeSubscriptionId === subscriptionId) {
      console.log("[CONFIRM_PAYMENT] Subscription already exists for user");
      return NextResponse.json({ success: true, message: "Subscription already active" });
    }

    // Get subscription details from Stripe
    const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price", "customer"],
    });

    const sub = subResp as unknown as SubscriptionWithPeriod;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const firstItem = sub.items.data[0];
    const price = firstItem.price;
    const priceId = typeof price === "string" ? price : price.id;

    const periodEnd = toDate(sub.current_period_end ?? null);

    // Upsert subscription
    await prismadb.userSubscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: periodEnd ?? new Date(),
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: periodEnd ?? new Date(),
      },
    });

    console.log("✅ [CONFIRM_PAYMENT] Subscription confirmed for user:", user.id);

    return NextResponse.json({ 
      success: true, 
      message: "Subscription activated successfully" 
    });

  } catch (error: any) {
    console.error("❌ [CONFIRM_PAYMENT] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}