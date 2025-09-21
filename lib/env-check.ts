/* eslint-disable @typescript-eslint/no-unused-vars */
// lib/env-check.ts
/**
 * Environment variable validation
 */

const requiredEnvVars = {
  // Clerk Auth
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // Stripe
  STRIPE_API_KEY: process.env.STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // App URL (critical for redirects)
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  
  // Redis/Upstash
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Pinecone (optional but recommended)
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
};

export function checkEnvVars() {
  const missing: string[] = [];
  
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  
  // Validate URL format
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL);
    } catch (e) {
      throw new Error(`NEXT_PUBLIC_APP_URL is not a valid URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
    }
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

// Auto-check in development
if (process.env.NODE_ENV === 'development') {
  checkEnvVars();
}