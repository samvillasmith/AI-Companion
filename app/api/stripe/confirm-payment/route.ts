/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/stripe/confirm-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(sec?: number | null) {
  if (typeof sec !== "number" || !sec) return null;
  return new Date(sec * 1000);
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

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Cast to any to access the properties we need
    const sub = subscription as any;

    console.log("[CONFIRM_PAYMENT] Raw subscription from Stripe:", {
      id: sub.id,
      status: sub.status,
      current_period_end: sub.current_period_end,
      current_period_start: sub.current_period_start,
      created: sub.created
    });

    // Get customer ID
    const customerId = typeof sub.customer === "string" 
      ? sub.customer 
      : sub.customer.id;

    // Get price ID
    const priceId = typeof sub.items.data[0].price === "string"
      ? sub.items.data[0].price
      : sub.items.data[0].price.id;

    // Get the period end - it should be on the subscription object directly
    const periodEndUnix = sub.current_period_end;
    
    if (!periodEndUnix) {
      console.error("[CONFIRM_PAYMENT] No period end found, using 30 days from now as fallback");
      // Fallback: 30 days from now
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      
      await prismadb.userSubscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: fallbackDate,
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: fallbackDate,
        },
      });
      
      console.log("✅ [CONFIRM_PAYMENT] Used fallback date for user:", user.id);
      return NextResponse.json({ 
        success: true, 
        message: "Subscription activated with fallback date" 
      });
    }

    // Convert unix timestamp to Date
    const periodEnd = new Date(periodEndUnix * 1000);

    console.log("[CONFIRM_PAYMENT] Subscription details:", {
      userId: user.id,
      subscriptionId: sub.id,
      periodEnd: periodEnd.toISOString(),
      periodEndUnix: periodEndUnix,
      status: sub.status
    });

    // Check if subscription already exists
    const existingSubscription = await prismadb.userSubscription.findUnique({
      where: { userId: user.id }
    });

    if (existingSubscription) {
      console.log("[CONFIRM_PAYMENT] Updating existing subscription");
    } else {
      console.log("[CONFIRM_PAYMENT] Creating new subscription");
    }

    // ALWAYS upsert/update subscription with correct end date from Stripe
    await prismadb.userSubscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: periodEnd,
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: periodEnd,
      },
    });

    console.log("✅ [CONFIRM_PAYMENT] Subscription confirmed/updated for user:", user.id, "expires:", periodEnd.toISOString());

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