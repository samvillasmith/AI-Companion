// app/api/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(sec?: number | null) {
  return sec ? new Date(sec * 1000) : null;
}

async function upsertUserSub(args: {
  userId: string;
  customerId: string;
  subId: string;
  priceId: string;
  periodEnd: Date | null;
}) {
  const { userId, customerId, subId, priceId, periodEnd } = args;

  await prismadb.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd ?? new Date(),
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd ?? new Date(),
    },
  });
}

export async function POST(req: Request) {
  // Stripe needs the raw body string to verify the signature
  const rawBody = await req.text();

  // Read the signature directly off the request (most reliable in app routes)
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ Missing Stripe-Signature header");
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Signature check failed:", err?.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("✅ WEBHOOK EVENT:", {
    type: event.type,
    id: event.id,
    live: event.livemode,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string | undefined;

        if (!userId) {
          console.warn("⚠️ checkout.session.completed: missing metadata.userId");
          break;
        }
        if (!subscriptionId) {
          console.warn("⚠️ checkout.session.completed: missing subscription id");
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await upsertUserSub({
          userId,
          customerId: sub.customer as string,
          subId: sub.id,
          priceId: sub.items.data[0].price.id,
          periodEnd: toDate(sub.current_period_end),
        });

        console.log("✅ upsert via checkout.session.completed", {
          userId,
          subId: sub.id,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        const updated = await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripePriceId: sub.items.data[0].price.id,
            stripeCurrentPeriodEnd:
              toDate(sub.current_period_end) ?? new Date(),
          },
        });

        console.log("✅ invoice.payment_succeeded -> updateMany", {
          subId: sub.id,
          count: updated.count,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        // 1) Prefer subscription metadata
        if (sub.metadata?.userId) {
          await upsertUserSub({
            userId: sub.metadata.userId,
            customerId: sub.customer as string,
            subId: sub.id,
            priceId: sub.items.data[0].price.id,
            periodEnd: toDate(sub.current_period_end),
          });
          console.log("✅ upsert via subscription.* metadata.userId", {
            userId: sub.metadata.userId,
            subId: sub.id,
          });
          break;
        }

        // 2) Try customer metadata
        const cust = await stripe.customers.retrieve(sub.customer as string);
        const customerMetadata =
          "metadata" in cust && cust.metadata ? cust.metadata : undefined;

        if (customerMetadata?.userId) {
          await upsertUserSub({
            userId: customerMetadata.userId,
            customerId: sub.customer as string,
            subId: sub.id,
            priceId: sub.items.data[0].price.id,
            periodEnd: toDate(sub.current_period_end),
          });
          console.log("✅ upsert via subscription.* customer.metadata.userId", {
            userId: customerMetadata.userId,
            subId: sub.id,
          });
          break;
        }

        // 3) Fall back to an existing DB row by sub/customer id
        const existing = await prismadb.userSubscription.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: sub.id },
              { stripeCustomerId: sub.customer as string },
            ],
          },
        });

        if (!existing) {
          console.warn(
            "⚠️ subscription.* without userId in metadata; no existing DB row",
            { subId: sub.id, customer: sub.customer }
          );
          break;
        }

        await upsertUserSub({
          userId: existing.userId,
          customerId: sub.customer as string,
          subId: sub.id,
          priceId: sub.items.data[0].price.id,
          periodEnd: toDate(sub.current_period_end),
        });
        console.log("✅ upsert via subscription.* using existing row", {
          userId: existing.userId,
          subId: sub.id,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const res = await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripeCurrentPeriodEnd:
              toDate(sub.current_period_end) ?? new Date(),
          },
        });
        console.log("✅ marked canceled", { subId: sub.id, count: res.count });
        break;
      }

      default:
        // Silence other event types to reduce noise
        // console.log("… ignoring", event.type);
        break;
    }

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err?.message);
    return new NextResponse(`Webhook handler failed: ${err.message}`, {
      status: 500,
    });
  }
}
