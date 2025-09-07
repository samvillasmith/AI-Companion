// lib/urls.ts
/**
 * Build an absolute URL and normalize slashes so you never get "//path".
 * Uses NEXT_PUBLIC_APP_URL if set, otherwise VERCEL_URL (prod) or localhost (dev).
 */
export function absolute(path: string): string {
  const baseRaw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const base = baseRaw.replace(/\/+$/, ""); // strip trailing slashes
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
