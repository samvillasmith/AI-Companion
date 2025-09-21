// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

declare global { 
  var __appRateLimiter: Ratelimit | undefined;
}

const rl =
  global.__appRateLimiter ??
  new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests / 10 seconds
    analytics: true,
    prefix: "ratelimit:chat",
  });

if (!global.__appRateLimiter) {
  global.__appRateLimiter = rl;
}

export async function rateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await rl.limit(identifier);
  return { success, limit, remaining, reset };
}
