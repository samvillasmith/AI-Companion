// app/api/stripe/route.ts
import { auth, currentUser } from "@clerk/nextjs/server"; // Note: /server not just @clerk/nextjs
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import prismadb from "@/lib/prismadb";

export async function GET() {
  try {
    const { userId } = await auth(); // Note: await auth() for server components
    const user = await currentUser();

    if (!userId || !user) {
      console.log("Auth failed - userId:", userId, "user:", !!user);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const settingsUrl = absoluteUrl("/settings");

    const userSubscription = await prismadb.userSubscription.findUnique({
      where: {
        userId
      }
    });

    // Existing subscription - billing portal
    if (userSubscription && userSubscription.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: settingsUrl,
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    // New subscription - checkout
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: settingsUrl,
      cancel_url: settingsUrl,
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
            unit_amount: 999,
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