/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/stripe/confirm/route.ts
import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

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
    // CRITICAL: Verify the current user is authenticated FIRST
    const user = await currentUser();
    if (!user) {
      console.error("[CONFIRM] No authenticated user found");
      // Redirect to sign-in with the intended destination
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', '/settings');
      return NextResponse.redirect(signInUrl);
    }

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

    const sessionUserId = session.metadata?.userId as string | undefined;
    const subscriptionId = session.subscription as string | undefined;

    if (!sessionUserId || !subscriptionId) {
      console.warn("[CONFIRM] Missing userId or subscriptionId", {
        sessionUserId,
        subscriptionId,
      });
      return new NextResponse("Missing metadata or subscription", { status: 400 });
    }

    // SECURITY CHECK: Ensure the session userId matches the authenticated user
    if (sessionUserId !== user.id) {
      console.error("[CONFIRM] User ID mismatch!", {
        sessionUserId,
        authenticatedUserId: user.id,
      });
      return new NextResponse("Unauthorized - session mismatch", { status: 403 });
    }

    // Pull subscription to get canonical values
    const subResp = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price", "customer"],
    });

    // Narrow types the safe way
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
      userId: user.id, // Use the authenticated user's ID
      customerId,
      subId: sub.id,
      priceId,
      periodEnd,
    });

    console.log("✅ [CONFIRM] upserted subscription", { userId: user.id, subId: sub.id });

    // Use a server-side redirect to maintain authentication
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    const successUrl = new URL('/', baseUrl);
    successUrl.searchParams.set('upgraded', 'true');
    successUrl.searchParams.set('success', 'true');
    
    // Use NextResponse.redirect for proper server-side redirect
    return NextResponse.redirect(successUrl);
    
  } catch (err: any) {
    console.error("❌ [CONFIRM] error:", err?.message);
    // On error, redirect to settings page
    const settingsUrl = new URL('/settings', req.url);
    return NextResponse.redirect(settingsUrl);
  }
}