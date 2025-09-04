// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Reuse a single limiter instance (nice during dev/hot reload)
const rl =
  (globalThis as any).__appRateLimiter ??
  new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests / 10 seconds
    analytics: true,
    prefix: "ratelimit:chat",
  });

if (!(globalThis as any).__appRateLimiter) {
  (globalThis as any).__appRateLimiter = rl;
}

export async function rateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await rl.limit(identifier);
  return { success, limit, remaining, reset };
}
