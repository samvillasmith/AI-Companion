/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(sec?: number | null) {
  return typeof sec === "number" ? new Date(sec * 1000) : null;
}

// Some Stripe @types revisions omit `current_period_end`; widen safely.
type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null;
};

// Your Stripe @types may also omit `invoice.subscription`; widen here too.
type InvoiceMaybeSub = Stripe.Invoice & {
  subscription?: string | null;
  subscription_details?: { subscription?: string | null } | null;
};

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("Stripe-Signature");
    if (!signature) return new NextResponse("Missing Stripe-Signature", { status: 400 });

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        if (!userId || !subscriptionId) {
          return new NextResponse("Missing userId or subscriptionId", { status: 400 });
        }

        // Get canonical subscription values
        const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price", "customer"],
        });
        const sub = subResp as unknown as SubscriptionWithPeriod;

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const firstItem = sub.items.data[0];
        const priceId = (firstItem.price as Stripe.Price).id;

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

        break;
      }

      case "invoice.payment_succeeded": {
        // Object is an Invoice; your TS may not include `subscription`
        const invoice = event.data.object as InvoiceMaybeSub;
        const subscriptionId =
          invoice.subscription ?? invoice.subscription_details?.subscription ?? null;

        if (!subscriptionId) {
          return new NextResponse("Missing subscriptionId on invoice", { status: 400 });
        }

        const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price", "customer"],
        });
        const sub = subResp as unknown as SubscriptionWithPeriod;

        const firstItem = sub.items.data[0];
        const priceId = (firstItem.price as Stripe.Price).id;

        await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: toDate(sub.current_period_end) ?? new Date(),
          },
        });

        break;
      }

      default:
        // ignore other events
        break;
    }

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("❌ [WEBHOOK] error:", err?.message || err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
