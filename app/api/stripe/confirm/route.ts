/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(sec?: number | null) {
  return typeof sec === "number" ? new Date(sec * 1000) : null;
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

export async function GET(req: NextRequest) {
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
    const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price", "customer"],
    });

    // Narrow types the safe way: some Stripe @types revisions omit `current_period_end`
    type SubscriptionWithPeriod = Stripe.Subscription & {
      current_period_end?: number | null;
    };
    const sub = subResp as unknown as SubscriptionWithPeriod;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const firstItem = sub.items.data[0];
    const price = firstItem.price;
    const priceId = typeof price === "string" ? price : price.id;

    const periodEnd = toDate(sub.current_period_end ?? null);

    await upsertUserSub({
      userId,
      customerId,
      subId: sub.id,
      priceId,
      periodEnd,
    });

    console.log("✅ [CONFIRM] upserted subscription", { userId, subId: sub.id });

    // IMPORTANT: Use a full URL redirect with hard reload
    // This ensures the page loads fresh without any cached states
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url.split('/api')[0];
    const redirectUrl = `${baseUrl}/?upgraded=true&success=true&timestamp=${Date.now()}`;
    
    // Return HTML that forces a full page reload
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Successful - Redirecting...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        </head>
        <body>
          <script>
            // Force a hard reload to the success page
            window.location.replace('${redirectUrl}');
          </script>
          <noscript>
            <meta http-equiv="refresh" content="0; url=${redirectUrl}">
          </noscript>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error("❌ [CONFIRM] error:", err?.message);
    return new NextResponse(`Confirm failed: ${err.message}`, { status: 500 });
  }
}