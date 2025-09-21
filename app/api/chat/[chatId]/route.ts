/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { generateText } from "ai";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

import { getTextModel, getProviderOptions } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await context.params;
    const { prompt } = await request.json();
    const user = await currentUser();

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized!", { status: 401 });
    }

    // basic rate limit
    const identifier = request.url + "-" + user.id;
    const { success } = await rateLimit(identifier);
    if (!success) return new NextResponse("Ratelimit Exceeded!", { status: 429 });

    // store user message
    const companion = await prismadb.companion.update({
      where: { id: chatId },
      data: {
        messages: {
          create: { content: prompt, role: "user", userId: user.id },
        },
      },
      select: { id: true, name: true, seed: true, instructions: true },
    });
    if (!companion) return new NextResponse("Companion Not Found.", { status: 404 });

    const displayName = companion.name ?? "Companion";
    const companion_file_name = companion.id + ".txt";

    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      // this string is used by your MemoryManager as a label, not to pick the LLM:
      modelName: process.env.AI_MODEL || "gpt-4o-mini",
    };

    const memoryManager = await MemoryManager.getInstance();

    // Seed memory first time
    const records = await memoryManager.readLatestHistory(companionKey);
    if (records.length === 0) {
      const seed = companion.seed ?? "You are a warm, respectful companion.";
      await memoryManager.seedChatHistory(seed, "\n\n", companionKey);
    }

    // Append user input to memory
    await memoryManager.writeToHistory("User: " + prompt + "\n", companionKey);

    // Short-term memory (recent transcript)
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    // Long-term memory (RAG)
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion_file_name
    );
    const relevantHistory =
      similarDocs && similarDocs.length
        ? similarDocs.map((d: any) => d.pageContent).join("\n")
        : "";

    // System prompt — same structure you had before
    const systemPrompt = `
You are ${displayName}, a warm, human-sounding companion. Talk like a friend, not a therapist.

QUESTION POLICY (must follow):
- Default: ask 0–1 short question per reply (max one “?”).
- Never ask questions in two consecutive replies.
- Only ask if it clearly helps; otherwise make a statement.
- If the user says “no questions”, “just comment”, or similar, ask none until invited.
- No rhetorical questions.

STYLE:
- 1–3 short sentences (≤80 words). Use contractions. Vary rhythm. Avoid filler.
- Prefer statements and commentary. Mirror the user’s tone and vocabulary.
- Don’t repeat empathy templates (skip “It sounds like…”, “I understand how you feel”).
- When giving ideas, offer 2–3 concise options, then stop (don’t follow with a question).
- Avoid disclaimers; keep healthy boundaries and decline unsafe content kindly.

ONLY generate plain sentences without any "Speaker:" prefixes.

Persona / instructions:
${(companion.instructions ?? companion.seed ?? "").trim()}

Relevant long-term memory (use if helpful; do not quote verbatim):
${relevantHistory || "—"}

Recent chat transcript (use for context; do not echo verbatim):
${recentChatHistory || "—"}
`.trim();

    // ---- NON-STREAMED GENERATION (preserves your RAG behavior) ----
    const model = getTextModel();
    const providerOptions = getProviderOptions();

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt, // latest user message only
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 500,
      // Safe default: keep Grok's web search off unless you enable it
      providerOptions,
    });

    const response = (text ?? "").trim() || "Okay.";

    // Persist assistant reply
    await memoryManager.writeToHistory(response, companionKey);
    await prismadb.companion.update({
      where: { id: chatId },
      data: {
        messages: {
          create: { content: response, role: "system", userId: user.id },
        },
      },
    });

    // Return plain text (what the client expects)
    return new Response(response, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
