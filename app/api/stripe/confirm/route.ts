/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/stripe/confirm/route.ts
import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return new NextResponse("Missing session_id", { status: 400 });
    }

    // Retrieve and verify the session directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // We only expect subscription mode checkouts here
    if (session.mode !== "subscription") {
      return new NextResponse("Invalid session mode", { status: 400 });
    }

    // Basic paid/complete guard
    const isPaid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      !!session.subscription;

    if (!isPaid) {
      return new NextResponse("Session not paid/complete", { status: 400 });
    }

    const userId = session.metadata?.userId as string | undefined;
    const subscriptionId = session.subscription as string | undefined;

    if (!userId || !subscriptionId) {
      console.warn("[CONFIRM] Missing userId or subscriptionId", {
        userId,
        subscriptionId,
      });
      return new NextResponse("Missing metadata or subscription", { status: 400 });
    }

    // Pull subscription to get canonical values
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    await upsertUserSub({
      userId,
      customerId: sub.customer as string,
      subId: sub.id,
      priceId: sub.items.data[0].price.id,
      periodEnd: toDate(sub.current_period_end),
    });

    console.log("✅ [CONFIRM] upserted subscription", { userId, subId: sub.id });

    // Redirect user back to the app; add a flag you can read for a toast if you like
    const redirectTo = new URL("/", req.url);
    redirectTo.searchParams.set("upgraded", "1");
    return NextResponse.redirect(redirectTo, 303);
  } catch (err: any) {
    console.error("❌ [CONFIRM] error:", err?.message);
    return new NextResponse(`Confirm failed: ${err.message}`, { status: 500 });
  }
}