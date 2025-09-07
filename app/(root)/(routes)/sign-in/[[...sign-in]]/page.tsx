"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";

export default function Page() {
  const cardWrapRef = useRef<HTMLDivElement | null>(null);
  const [{ top, height }, setBox] = useState({ top: 0, height: 0 });

  // read ?redirect_url=..., default to /settings
  const searchParams = useSearchParams();
  const target = searchParams.get("redirect_url") || "/settings";

  useEffect(() => {
    const update = () => {
      const el = cardWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: Math.max(0, Math.round(r.top)), height: Math.round(r.height) });
    };

    update(); // initial
    const ro = new ResizeObserver(update);
    if (cardWrapRef.current) ro.observe(cardWrapRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="relative min-h-screen text-white bg-[#0b0b0d]">
      {/* background wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 opacity-80 bg-[radial-gradient(1200px_800px_at_50%_-10%,rgba(59,130,246,0.20),transparent_70%)]" />
        <div className="absolute inset-0 mix-blend-screen opacity-70 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(99,102,241,0.18),rgba(217,70,239,0.18),rgba(236,72,153,0.18),rgba(99,102,241,0.18))]" />
      </div>

      {/* EDGE IMAGES — match card top/height, desktop only */}
      <div
        aria-hidden
        className="pointer-events-none hidden lg:block fixed left-4 z-0"
        style={{ top, height }}
      >
        <div className="relative h-full w-[min(26vw,340px)]">
          <Image
            src="/comp1.png"
            alt=""
            fill
            priority
            draggable={false}
            className="rounded-2xl object-cover shadow-xl ring-1 ring-white/10"
            sizes="(min-width:1024px) 26vw, 0px"
          />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none hidden lg:block fixed right-4 z-0"
        style={{ top, height }}
      >
        <div className="relative h-full w-[min(26vw,340px)]">
          <Image
            src="/comp2.png"
            alt=""
            fill
            priority
            draggable={false}
            className="rounded-2xl object-cover shadow-xl ring-1 ring-white/10"
            sizes="(min-width:1024px) 26vw, 0px"
          />
        </div>
      </div>

      {/* CENTER CONTENT */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-10 pb-40">
        <div className="w-full max-w-md mx-auto text-center" ref={cardWrapRef}>
          <h1 className="mb-2 text-4xl sm:text-5xl font-extrabold tracking-wide bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            TELMII
          </h1>
          <p className="mb-6 text-sm text-white/75">Create & chat with custom AI companions.</p>

          {/* If already signed in, skip rendering <SignIn/> and go straight to target */}
          <SignedIn>
            <ImmediateRedirect to={target} />
          </SignedIn>

          {/* If signed out, render your styled Clerk SignIn */}
          <SignedOut>
            <SignIn
              forceRedirectUrl={target}
              fallbackRedirectUrl={target}
              appearance={{
                elements: {
                  card: "shadow-none border-0 bg-transparent p-0",
                  headerTitle: "text-center",
                  headerSubtitle: "text-center",
                },
              }}
            />
          </SignedOut>
        </div>
      </div>

      {/* bullets */}
      <div className="fixed inset-x-0 bottom-20 sm:bottom-24 px-4">
        <ul className="mx-auto max-w-6xl flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
          <Bullet>Create companions</Bullet>
          <Bullet>Pick categories</Bullet>
          <Bullet>Customize vibes</Bullet>
          <Bullet>Chat instantly</Bullet>
          <Bullet>Built for mobile</Bullet>
          <Bullet>Private & secure</Bullet>
          <Bullet>Mentors & coaching</Bullet>
          <Bullet>Travel planning</Bullet>
          <Bullet>Movies & TV chat</Bullet>
          <Bullet>Music discovery</Bullet>
          <Bullet>Gaming buddies</Bullet>
          <Bullet>Tech & coding</Bullet>
        </ul>
      </div>

      <style>{`.cl-footer{display:none !important;}`}</style>
    </div>
  );
}

function ImmediateRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-base sm:text-lg font-bold">
      <span className="h-3 w-3 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.5)]" />
      <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
        {children}
      </span>
    </li>
  );
}
