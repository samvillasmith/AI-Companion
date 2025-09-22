// app/api/chat/[chatId]/route.ts
import "server-only";
import { NextResponse } from "next/server";
import type { ChatMessage, ProviderName } from "@/lib/llm";
import {
  getProviderAndModelForCompanion,
  normalizeMessagesForProvider,
  gatewayBase,
} from "@/lib/llm";
import { auth } from "@clerk/nextjs/server";

type Params = { chatId: string };

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await ctx.params;

  // Accept either {content} or full {messages}
  const body = await req.json().catch(() => ({}));
  let { content, messages, category, personality, provider, model } = body as {
    content?: string;
    messages?: ChatMessage[];
    category?: string | null;
    personality?: string | null;
    provider?: ProviderName;
    model?: string;
  };

  // Build raw messages list
  let raw: ChatMessage[] = Array.isArray(messages) ? messages.slice() : [];
  if (typeof content === "string" && content.length) {
    raw.push({ role: "user", content });
  }
  if (!raw.length) {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  // Decide provider/model
  const pick = getProviderAndModelForCompanion(category ?? "Mentors", null);
  provider = provider ?? pick.provider;
  model = model ?? pick.modelName;

  // ******** THE IMPORTANT LINE ********
  // Normalize at the VERY LAST MOMENT before sending out.
  const finalMsgs = normalizeMessagesForProvider(provider, raw);

  // Optional: debug log to prove alternation
  try {
    console.log("[FINAL_MSGS]", finalMsgs.map((m) => m.role));
  } catch {}

  // Call your local gateway (expects v1/chat with provider/model/messages)
  const resp = await fetch(`${gatewayBase()}/v1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      messages: finalMsgs,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("[GATEWAY_ERROR]", resp.status, text);
    return NextResponse.json(
      { error: "gateway_error", detail: text || `status ${resp.status}` },
      { status: 502 }
    );
  }

  const data = await resp.json();
  return NextResponse.json({ chatId, data });
}
