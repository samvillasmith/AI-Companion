/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

// Use the AI SDK client (do NOT pass a second arg to openai())
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

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
      modelName: "gpt-4o-mini",
    };

    const memoryManager = await MemoryManager.getInstance();

    // seed memory first time
    const records = await memoryManager.readLatestHistory(companionKey);
    if (records.length === 0) {
      const seed = companion.seed ?? "You are a warm, respectful companion.";
      await memoryManager.seedChatHistory(seed, "\n\n", companionKey);
    }

    // append user input to memory
    await memoryManager.writeToHistory("User: " + prompt + "\n", companionKey);

    // short-term memory (recent transcript)
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    // long-term memory (RAG)
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion_file_name
    );
    const relevantHistory =
      similarDocs && similarDocs.length
        ? similarDocs.map((d: any) => d.pageContent).join("\n")
        : "";

    // system prompt — updated to sound more human and ask fewer questions
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

    // ---- NON-STREAMED GENERATION ----
    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // client above carries the key
      system: systemPrompt,
      prompt,                       // latest user message only
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 500,
    });

    const response = (text ?? "").trim() || "Okay.";

    // persist assistant reply (DB still uses "system"; UI maps to avatar)
    await memoryManager.writeToHistory(response, companionKey);
    await prismadb.companion.update({
      where: { id: chatId },
      data: {
        messages: {
          create: { content: response, role: "system", userId: user.id },
        },
      },
    });

    // return plain text (what the client expects)
    return new Response(response, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
