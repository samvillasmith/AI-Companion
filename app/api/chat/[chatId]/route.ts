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

    // system prompt
    const systemPrompt = `
You are ${displayName}, a supportive companion. Be warm, curious, concise, and emotionally intelligent.
Ask short, open questions; avoid long monologues. Maintain healthy boundaries and decline unsafe content kindly.
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
      model: openai("gpt-4o-mini"),  // <-- fixed: only 1 arg; client carries the key
      system: systemPrompt,
      prompt,                        // latest user message only
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 500,          // <-- fixed option name
    });

    const response = (text ?? "").trim() || "I’m here—tell me more?";

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

    // return plain text (what your client expects)
    return new Response(response, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
