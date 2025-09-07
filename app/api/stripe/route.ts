// app/api/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth, clerkClient, currentUser } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";
import { absolute } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const successConfirmUrl = absolute("/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}");

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // If customer exists, send to Billing Portal
    const userSubscription = await prismadb.userSubscription.findUnique({
      where: { userId },
    });

    if (userSubscription?.stripeCustomerId) {
      // FIXED: Direct return to /settings instead of going through API route
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url.split('/api')[0];
      const returnUrl = `${baseUrl}/settings`;
      
      const portal = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: returnUrl,
      });
      
      return NextResponse.json({ url: portal.url });
    }

    // Optional email for Checkout
    let email: string | undefined;
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        undefined;

      if (!email) {
        const cu = await currentUser();
        email =
          cu?.primaryEmailAddress?.emailAddress ??
          cu?.emailAddresses?.[0]?.emailAddress ??
          undefined;
      }
    } catch {
      // proceed without email; Stripe will collect it
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
      success_url: successConfirmUrl,
      cancel_url: absolute("/"),
      billing_address_collection: "auto",
      customer_email: email,
      line_items: [lineItem],
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