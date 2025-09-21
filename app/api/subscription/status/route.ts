// app/api/subscription/status/route.ts
import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isPremium = await checkSubscription();
    return NextResponse.json(
      { isPremium, ts: Date.now() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { isPremium: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
