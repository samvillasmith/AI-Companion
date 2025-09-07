/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

// OpenAI client (single-arg use later)
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// crude detector: did the last assistant reply contain a question?
function askedAQuestionRecently(history: string): boolean {
  const lines = history.split("\n").map((l) => l.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    if (line.startsWith("User:")) return false;      // hit a user line first → no recent assistant question
    // first non-user line is the last assistant reply in this scheme
    return line.includes("?");
  }
  return false;
}

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
      modelName: "gpt-5-thinking",
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

    // compute question allowance
    const userBansQuestions = /no questions|stop asking/i.test(prompt ?? "");
    const askedRecently = askedAQuestionRecently(recentChatHistory);
    const questionAllowance = userBansQuestions ? 0 : askedRecently ? 0 : 1;

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
You are ${displayName}, a supportive companion. Speak naturally and concisely (1–2 short paragraphs). Offer commentary and suggestions; avoid sounding like an interviewer.

QUESTION POLICY (must obey):
- Maximum questions you may ask in this reply: ${questionAllowance}.
- Do not ask questions in two consecutive assistant replies.
- If maximum is 0, do not ask any question at all; avoid rhetorical questions and avoid '?'.

STYLE:
- Use contractions and vary rhythm.
- Prefer statements. When giving options, list at most 2–3.
- Avoid repeating stock openers (e.g., "It sounds like...").
- Keep boundaries; decline unsafe content kindly.

Persona / instructions:
${(companion.instructions ?? companion.seed ?? "").trim()}

Relevant long-term memory (use if helpful; do not quote verbatim):
${relevantHistory || "—"}

Recent chat transcript (use for context; do not echo verbatim):
${recentChatHistory || "—"}
`.trim();

    // ---- NON-STREAMED GENERATION ----
    const { text } = await generateText({
      model: openai("gpt-5-thinking"),
      system: systemPrompt,
      prompt,                         // latest user message only
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0.5,          // reduce repetitiveness / question spam
      presencePenalty: 0.1,
      maxOutputTokens: 500,
    });

    const response = (text ?? "").trim() || "Okay. I’m here.";

    // persist assistant reply
    await memoryManager.writeToHistory(response, companionKey);
    await prismadb.companion.update({
      where: { id: chatId },
      data: {
        messages: {
          create: { content: response, role: "system", userId: user.id },
        },
      },
    });

    return new Response(response, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
