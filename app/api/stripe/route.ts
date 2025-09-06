// app/api/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";
import { absolute } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoid caching surprises

// We'll route success through our confirm endpoint so DB is written even without webhooks
const successConfirmUrl = absolute("/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}");
// Use a real page that exists in your app ("/" if /settings 404s)
const cancelUrl = absolute("/");

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // If customer exists, send to Billing Portal
    const userSubscription = await prismadb.userSubscription.findUnique({
      where: { userId },
    });

    if (userSubscription?.stripeCustomerId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: cancelUrl,
      });
      return NextResponse.json({ url: portal.url });
    }

    // Optional email for Checkout
    let email: string | undefined;
    try {
      const user = await clerkClient.users.getUser(userId);
      email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        undefined;
    } catch {
      // proceed without email; Stripe will collect
    }

    const lineItem = process.env.STRIPE_PRICE_ID
      ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 as const }
      : {
          quantity: 1 as const,
          price_data: {
            currency: "usd",
            unit_amount: 1999,
            recurring: { interval: "month" as const },
            product_data: {
              name: "Premium Companion Access",
              description: "Create Your Own Custom AI Companions",
            },
          },
        };

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: successConfirmUrl, // <-- our confirm endpoint
      cancel_url: cancelUrl,
      billing_address_collection: "auto",
      customer_email: email,
      line_items: [lineItem],
      // make sure both the session and resulting subscription carry userId
      subscription_data: {
        metadata: { userId },
      },
      metadata: { userId },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[STRIPE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}