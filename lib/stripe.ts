// lib/stripe.ts
import Stripe from "stripe";

// Function to get Stripe instance with lazy initialization
function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;
  
  if (!apiKey) {
    console.error("Stripe API key not found. Checked:");
    console.error("- STRIPE_API_KEY:", !!process.env.STRIPE_API_KEY);
    console.error("- STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);
    console.error("Environment:", process.env.NODE_ENV);
    
    throw new Error(
      "Missing Stripe API key. Please ensure STRIPE_API_KEY is set in your environment variables."
    );
  }

  return new Stripe(apiKey, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
}

// Export a getter that creates the instance only when needed
let stripeInstance: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    if (!stripeInstance) {
      stripeInstance = getStripe();
    }
    return (stripeInstance as any)[prop];
  },
});