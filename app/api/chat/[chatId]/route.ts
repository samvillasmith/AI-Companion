/* eslint-disable @typescript-eslint/no-unused-vars */
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

    // Read conversation history from Redis (user-scoped)
    const records = await memoryManager.readLatestHistory(companionKey);
    if (!records || records.length === 0) {
      // Seed the chat history if this is first interaction
      await memoryManager.seedChatHistory(
        companion.seed || `Human: Hello ${companion.name}!\n${companion.name}: *waves* Hey there! ${companion.description}. How can I help you today?`,
        "\n",
        companionKey
      );
    }

    // Write user input to history (consider setting storeInPinecone to true for important messages)
    await memoryManager.writeToHistory(
      `Human: ${userInput}`, 
      companionKey,
      false  // Set to true if you want to store user messages in Pinecone
    );

    // Get recent chat history for context
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    // Perform vector search for relevant context (RAG) - NOW WITH USER SCOPING
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion.name,
      userId  // CRITICAL: Pass userId to prevent cross-user data leakage
    );

    let relevantHistory = "";
    if (similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
      console.log(`[CHAT_API] Found ${similarDocs.length} relevant memory chunks for user ${userId}`);
    }

    // Build the messages array with full context
    const messages: ChatMessage[] = [];

    // System message with companion instructions and personality
    const systemPrompt = `You are ${companion.name}. ${companion.description}.

IMPORTANT INSTRUCTIONS:
1. Respond in character as ${companion.name}.
2. Keep your responses concise and conversational (2-4 sentences is ideal, maximum 1-2 short paragraphs).
3. Be natural and engaging, but don't overwhelm with too much information.
4. Stay focused on the current topic without going off on tangents.
5. If asked what you remember, only reference conversations with this specific user.

${companion.instructions}

${companion.seed ? `Example conversation style:\n${companion.seed}\n` : ""}

${relevantHistory ? `Relevant context from your past conversations with this user:\n${relevantHistory}\n` : ""}

Recent conversation history:
${recentChatHistory}

Remember: Be helpful but concise. Quality over quantity. Only reference memories from THIS user's conversations.`;

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
      ragDocsFound: similarDocs.length,
    });

    // Normalize messages for the provider
    const finalMsgs = normalizeMessagesForProvider(provider, messages);

    // Call your local gateway with reduced token limit for more concise responses
    const gatewayUrl = `${gatewayBase()}/v1/chat`;
    console.log(`[CHAT_API] Calling gateway:`, gatewayUrl);
    
    const resp = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        messages: finalMsgs,
        temperature: 0.7, // Reduced from 0.9 for more focused responses
        max_output_tokens: 256, // Reduced from 1024 to keep responses concise
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[GATEWAY_ERROR]", resp.status, text);
      await memoryManager.writeToHistory(
        `${companion.name}: Sorry, I had an issue. Can you try again?`,
        companionKey,
        false
      );
      return NextResponse.json(
        { error: "gateway_error", detail: text || `status ${resp.status}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    let aiResponse = data.text || "I'm here—tell me more?";
    
    // Clean up any escape characters that might appear in the response
    aiResponse = aiResponse
      .replace(/\\n/g, '\n')           // Replace literal \n with actual newlines
      .replace(/\\"/g, '"')             // Replace escaped quotes with regular quotes
      .replace(/^["']|["']$/g, '')      // Remove leading/trailing quotes
      .replace(/\\/g, '')               // Remove any remaining backslashes
      .trim();

    // Write AI response to history (consider storing important responses in Pinecone)
    await memoryManager.writeToHistory(
      `${companion.name}: ${aiResponse}`,
      companionKey,
      false  // Set to true if you want to store assistant responses in Pinecone
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
    
    // Return plain text response for compatibility with the client
    return new Response(aiResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error("[CHAT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Optional: DELETE endpoint to clear user's memory with a companion
export async function DELETE(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chatId } = await ctx.params;

    // Verify companion exists
    const companion = await prismadb.companion.findUnique({
      where: { id: chatId },
      select: { id: true, name: true },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    // Clear user's memories with this companion
    const memoryManager = await MemoryManager.getInstance();
    const companionKey = {
      companionName: companion.name,
      modelName: "chatgpt",
      userId: userId,
    };

    await memoryManager.clearUserMemories(companionKey);

    // Also delete database messages for this user and companion
    await prismadb.message.deleteMany({
      where: {
        companionId: companion.id,
        userId: userId,
      },
    });

    console.log(`[CHAT_API] Cleared memories for user ${userId} with companion ${companion.name}`);

    return NextResponse.json({ success: true, message: "Memories cleared" });

  } catch (error) {
    console.error("[CHAT_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}