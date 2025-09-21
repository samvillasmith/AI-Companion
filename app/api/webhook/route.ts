/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/webhook/route.ts
import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disable body parsing, we need raw body for webhook verification
export const maxDuration = 60;

function toDate(sec?: number | null) {
  return typeof sec === "number" ? new Date(sec * 1000) : null;
}

// Type helpers
type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null;
};

type InvoiceMaybeSub = Stripe.Invoice & {
  subscription?: string | null;
  subscription_details?: { subscription?: string | null } | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature");
    
    if (!signature) {
      console.error("[WEBHOOK] Missing Stripe-Signature header");
      return new NextResponse("Missing Stripe-Signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("[WEBHOOK] Signature verification failed:", err.message);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log("[WEBHOOK] Processing event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        if (!userId || !subscriptionId) {
          console.error("[WEBHOOK] Missing userId or subscriptionId in session", {
            sessionId: session.id,
            userId,
            subscriptionId
          });
          return new NextResponse("Missing userId or subscriptionId", { status: 400 });
        }

        // Get subscription details from Stripe
        const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price", "customer"],
        });
        const sub = subResp as unknown as SubscriptionWithPeriod;

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const firstItem = sub.items.data[0];
        const priceId = (firstItem.price as Stripe.Price).id;

        // Upsert the subscription
        await prismadb.userSubscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: toDate(sub.current_period_end) ?? new Date(),
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: toDate(sub.current_period_end) ?? new Date(),
          },
        });

        console.log("[WEBHOOK] ✅ Checkout completed for user:", userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as InvoiceMaybeSub;
        const subscriptionId =
          invoice.subscription ?? invoice.subscription_details?.subscription ?? null;

        if (!subscriptionId) {
          console.warn("[WEBHOOK] Invoice has no subscription ID");
          return new NextResponse("Missing subscriptionId on invoice", { status: 200 });
        }

        // Get updated subscription details
        const subResp = await stripe.subscriptions.retrieve(subscriptionId as string, {
          expand: ["items.data.price", "customer"],
        });
        const sub = subResp as unknown as SubscriptionWithPeriod;

        const firstItem = sub.items.data[0];
        const priceId = (firstItem.price as Stripe.Price).id;

        // Update existing subscription
        const updateResult = await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: toDate(sub.current_period_end) ?? new Date(),
          },
        });

        if (updateResult.count === 0) {
          console.warn("[WEBHOOK] No subscription found to update:", sub.id);
        } else {
          console.log("[WEBHOOK] ✅ Invoice payment succeeded, updated subscription:", sub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Handle subscription cancellation
        const deleteResult = await prismadb.userSubscription.deleteMany({
          where: { stripeSubscriptionId: subscription.id }
        });

        if (deleteResult.count > 0) {
          console.log("[WEBHOOK] ✅ Subscription deleted:", subscription.id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as SubscriptionWithPeriod;
        
        // Handle subscription updates (like plan changes)
        const firstItem = subscription.items.data[0];
        const priceId = typeof firstItem.price === "string" 
          ? firstItem.price 
          : (firstItem.price as Stripe.Price).id;

        await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: toDate(subscription.current_period_end) ?? new Date(),
          },
        });

        console.log("[WEBHOOK] ✅ Subscription updated:", subscription.id);
        break;
      }

      default:
        console.log("[WEBHOOK] Unhandled event type:", event.type);
    }

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("❌ [WEBHOOK] Unexpected error:", err?.message || err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}