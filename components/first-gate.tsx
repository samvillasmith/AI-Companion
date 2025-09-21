/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

function isWithinMinutes(a: Date | null | undefined, b: Date | null | undefined, minutes = 5) {
  if (!a || !b) return false;
  return Math.abs(+a - +b) <= minutes * 60 * 1000;
}

export default function FirstSignInGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!isLoaded || !isSignedIn || !user) return;

    // One-time guard via unsafeMetadata
    const alreadyHandled = Boolean((user.unsafeMetadata as any)?.firstRunHandled);

    // Heuristic for "first sign-in":
    // If lastSignInAt is essentially the creation time (within ~5 minutes), treat as first sign-in.
    const firstSignInLikely = isWithinMinutes(user.lastSignInAt, user.createdAt, 5);

    if (!alreadyHandled && firstSignInLikely) {
      ran.current = true;
      // Mark as handled so it never triggers again (no server DB needed)
      user
        .update({
          unsafeMetadata: { ...(user.unsafeMetadata as any), firstRunHandled: true },
        })
        .catch(() => {
          /* non-blocking */
        })
        .finally(() => {
          // Preserve any downstream redirect plan if you have one
          const next = "/";
          window.location.replace(`/first-run?next=${encodeURIComponent(next)}`);
        });
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
