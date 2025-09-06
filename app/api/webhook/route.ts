import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get("Stripe-Signature") as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // Handle the events
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                
                if (!session?.metadata?.userId) {
                    return new NextResponse("User ID is required", { status: 400 });
                }

                const subscription = await stripe.subscriptions.retrieve(
                    session.subscription as string
                );

                await prismadb.userSubscription.create({
                    data: {
                        userId: session.metadata.userId,
                        stripeSubscriptionId: subscription.id,
                        stripeCustomerId: subscription.customer as string,
                        stripePriceId: subscription.items.data[0].price.id,
                        stripeCurrentPeriodEnd: new Date(
                            subscription.current_period_end * 1000
                        ),
                    },
                });
                console.log("✅ Subscription created for user:", session.metadata.userId);
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object as Stripe.Invoice;
                
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(
                        invoice.subscription as string
                    );

                    await prismadb.userSubscription.update({
                        where: {
                            stripeSubscriptionId: subscription.id
                        },
                        data: {
                            stripePriceId: subscription.items.data[0].price.id,
                            stripeCurrentPeriodEnd: new Date(
                                subscription.current_period_end * 1000
                            )
                        }
                    });
                    console.log("✅ Subscription updated:", subscription.id);
                }
                break;
            }

            // Handle test events from Stripe CLI
            case "payment_intent.succeeded":
                console.log("✅ Payment intent succeeded:", event.data.object.id);
                break;
            
            case "payment_intent.created":
                console.log("✅ Payment intent created:", event.data.object.id);
                break;
            
            case "charge.succeeded":
                console.log("✅ Charge succeeded:", event.data.object.id);
                break;
            
            case "charge.updated":
                console.log("✅ Charge updated:", event.data.object.id);
                break;

            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
        }

        return new NextResponse(null, { status: 200 });
        
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("❌ Webhook handler error:", error);
        return new NextResponse(
            `Webhook handler failed: ${error.message}`,
            { status: 500 }
        );
    }
}