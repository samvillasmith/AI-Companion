// app/api/stripe/route.ts
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get the authenticated user
    const user = await currentUser();
    
    if (!user || !user.id) {
      console.log("[STRIPE] No authenticated user");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Double-check we have valid user data
    if (!user.emailAddresses || user.emailAddresses.length === 0) {
      console.error("[STRIPE] User has no email addresses");
      return new NextResponse("User email required", { status: 400 });
    }

    const userSubscription = await prismadb.userSubscription.findUnique({
      where: { userId: user.id }
    });

    // Existing subscription - billing portal
    if (userSubscription && userSubscription.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: absoluteUrl("/settings"),
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    // New subscription - checkout
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: absoluteUrl("/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absoluteUrl("/settings"),
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: user.emailAddresses[0].emailAddress,
      line_items: [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: "AI Companion Premium",
              description: "Unlimited AI Companion Messages"
            },
            unit_amount: 1999,
            recurring: {
              interval: "month"
            }
          },
          quantity: 1,
        }
      ],
      metadata: {
        userId: user.id, // Critical: Pass the authenticated user's ID
      },
      // Add client reference ID for additional validation
      client_reference_id: user.id,
    });

    console.log("[STRIPE] Created checkout session for user:", user.id);
    return NextResponse.json({ url: stripeSession.url });
    
  } catch (error) {
    console.error("[STRIPE_GET] Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}