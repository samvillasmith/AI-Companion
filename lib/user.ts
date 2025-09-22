import type { User } from "@clerk/nextjs/server";

export function getDisplayName(user: User | null | undefined) {
  if (!user) return "Anonymous";
  return (
    user.firstName ??
    user.username ??
    user.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "Anonymous"
  );
}
