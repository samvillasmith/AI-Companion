import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import prismadb from "@/lib/prismadb";

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      console.log("[STRIPE] Auth failed:", { userId, user: !!user });
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userSubscription = await prismadb.userSubscription.findUnique({
      where: { userId }
    });

    // Existing subscription - billing portal
    if (userSubscription && userSubscription.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: absoluteUrl("/settings"), // Direct to settings page
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
        userId,
      }
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("[STRIPE_GET] Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}