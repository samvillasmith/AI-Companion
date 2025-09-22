// app/api/chat/[chatId]/route.ts
import "server-only";
import { NextResponse } from "next/server";
import type { ChatMessage, ProviderName } from "@/lib/llm";
import {
  getProviderAndModelForCompanion,
  normalizeMessagesForProvider,
  gatewayBase,
  parsePersonalityTag,
} from "@/lib/llm";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";

type Params = { chatId: string };

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chatId } = await ctx.params;

    // Rate limiting
    const identifier = `${req.url}-${userId}`;
    const { success } = await rateLimit(identifier);
    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    // Accept either {prompt}, {content} or full {messages}
    const body = await req.json().catch(() => ({}));
    const userInput = body.prompt || body.content || "";
    
    if (!userInput) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    // Fetch the companion with its category
    const companion = await prismadb.companion.findUnique({
      where: { id: chatId },
      include: {
        category: true,
        messages: {
          orderBy: { createdAt: "asc" },
          where: { userId },
          take: 10, // Last 10 messages for context
        },
      },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    // Update companion's message count
    await prismadb.companion.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    // Initialize memory manager
    const memoryManager = await MemoryManager.getInstance();
    const companionKey = {
      companionName: companion.name,
      modelName: "chatgpt",
      userId: userId,
    };

    // Read conversation history from Redis
    const records = await memoryManager.readLatestHistory(companionKey);
    if (!records || records.length === 0) {
      // Seed the chat history if this is first interaction
      await memoryManager.seedChatHistory(
        companion.seed || `Human: Hello ${companion.name}!\n${companion.name}: *waves* Hey there! ${companion.description}. How can I help you today?`,
        "\n",
        companionKey
      );
    }

    // Write user input to history
    await memoryManager.writeToHistory(`Human: ${userInput}`, companionKey);

    // Get recent chat history for context
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    // Perform vector search for relevant context (RAG)
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion.name
    );

    let relevantHistory = "";
    if (similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
    }

    // Build the messages array with full context
    const messages: ChatMessage[] = [];

    // System message with companion instructions and personality
    const systemPrompt = `You are ${companion.name}. ${companion.description}.

IMPORTANT: Respond in character as ${companion.name}. ${companion.instructions}

${companion.seed ? `Example conversation style:\n${companion.seed}\n` : ""}

${relevantHistory ? `Relevant context from past conversations:\n${relevantHistory}\n` : ""}

Recent conversation history:
${recentChatHistory}

Stay in character and respond naturally as ${companion.name} would.`;

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    // Add the current user message
    messages.push({
      role: "user",
      content: userInput,
    });

    // Decide provider/model based on category
    const personality = parsePersonalityTag(companion.seed);
    const pick = getProviderAndModelForCompanion(companion.category.name, personality);
    const provider = pick.provider;
    const model = pick.modelName;

    // LOG THE MODEL BEING CALLED
    console.log(`[CHAT_API] Calling model:`, {
      chatId,
      provider,
      model,
      category: companion.category.name,
      personality,
      messageCount: messages.length,
      userId,
      companionName: companion.name,
    });

    // Normalize messages for the provider
    const finalMsgs = normalizeMessagesForProvider(provider, messages);

    // Call your local gateway
    const gatewayUrl = `${gatewayBase()}/v1/chat`;
    console.log(`[CHAT_API] Calling gateway:`, gatewayUrl);
    
    const resp = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        messages: finalMsgs,
        temperature: 0.9,
        max_output_tokens: 1024,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[GATEWAY_ERROR]", resp.status, text);
      await memoryManager.writeToHistory(
        `${companion.name}: Sorry, I had an issue. Can you try again?`,
        companionKey
      );
      return NextResponse.json(
        { error: "gateway_error", detail: text || `status ${resp.status}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const aiResponse = data.text || "I'm here—tell me more?";

    // Write AI response to history
    await memoryManager.writeToHistory(
      `${companion.name}: ${aiResponse}`,
      companionKey
    );

    // Store message in database
    await prismadb.message.create({
      data: {
        companionId: companion.id,
        userId,
        content: userInput,
        role: "user",
      },
    });

    await prismadb.message.create({
      data: {
        companionId: companion.id,
        userId,
        content: aiResponse,
        role: "system",
      },
    });
    
    console.log(`[CHAT_API] Response received for model ${model} (${provider})`);
    
    // Return just the text content for compatibility with the client
    return NextResponse.json(aiResponse);

  } catch (error) {
    console.error("[CHAT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}