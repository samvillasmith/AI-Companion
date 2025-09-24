/* memoryManager.ts

Purpose: Provide a simple "memory" layer for an AI companion.
- Short-term memory: chat history stored in Upstash Redis (as a sorted set).
- Long-term memory: semantic recall via Pinecone + LangChain similarity search.

Requirements (env):
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (for Redis.fromEnv())
- PINECONE_API_KEY, PINECONE_INDEX (for Pinecone v2)
- OPENAI_API_KEY (for embedding generation)
*/

import { Redis } from "@upstash/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  private static instance: MemoryManager;
  private history: Redis;

  // Pinecone v2 objects
  private pinecone?: Pinecone;
  private pineconeIndexName?: string;

  private constructor() {
    this.history = Redis.fromEnv();
    this.pineconeIndexName = process.env.PINECONE_INDEX || undefined;
  }

  /**
   * Lazy-init Pinecone v2 client and cache it.
   */
  private ensurePinecone() {
    if (!this.pinecone) {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error("PINECONE_API_KEY is not set");
      }
      if (!this.pineconeIndexName) {
        throw new Error("PINECONE_INDEX is not set");
      }
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    }
  }

  /**
   * Perform a similarity search against the existing Pinecone index using
   * OpenAI embeddings. Filters by BOTH `fileName` (companion name) AND `userId`.
   *
   * @param recentChatHistory - The query text (e.g., recent messages).
   * @param companionFileName - The metadata `fileName` to filter results by.
   * @param userId - The user ID to filter results by (CRITICAL FOR PRIVACY).
   */
  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string,
    userId: string
  ) {
    try {
      this.ensurePinecone();
      const index = this.pinecone!.Index(this.pineconeIndexName!);

      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        // namespace: process.env.PINECONE_NAMESPACE, // optional
      });

      // Top-3 most similar docs, filtered by BOTH fileName AND userId
      const similarDocs = await vectorStore.similaritySearch(
        recentChatHistory,
        3,
        { 
          fileName: companionFileName,
          userId: userId  // CRITICAL: Filter by user ID to prevent cross-user data leakage
        }
      );

      return similarDocs;
    } catch (err) {
      console.log("Failed to get vector search results", err);
      return [];
    }
  }

  /**
   * Store a new memory in Pinecone with proper user scoping.
   * This ensures all vectors are tagged with userId for retrieval filtering.
   *
   * @param text - The text to store
   * @param companionKey - The companion key containing userId
   */
  public async storeMemory(text: string, companionKey: CompanionKey) {
    try {
      this.ensurePinecone();
      const index = this.pinecone!.Index(this.pineconeIndexName!);

      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
      });

      // Create a document with proper metadata
      const doc = new Document({
        pageContent: text,
        metadata: {
          fileName: companionKey.companionName,
          userId: companionKey.userId,  // CRITICAL: Include userId in metadata
          timestamp: Date.now(),
          modelName: companionKey.modelName,
        },
      });

      // Store the document
      await vectorStore.addDocuments([doc]);

      return true;
    } catch (err) {
      console.error("Failed to store memory in Pinecone", err);
      return false;
    }
  }

  /**
   * Get or create the singleton instance of MemoryManager.
   */
  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Build a Redis key that uniquely identifies one companion+model+user tuple.
   */
  private generateRedisCompanionKey(companionKey: CompanionKey): string {
    return `${companionKey.companionName}-${companionKey.modelName}-${companionKey.userId}`;
  }

  /**
   * Append one message to the user's chat history (sorted by timestamp).
   * Optionally store significant messages in Pinecone for long-term RAG.
   */
  public async writeToHistory(text: string, companionKey: CompanionKey, storeInPinecone: boolean = false) {
    if (!companionKey || typeof companionKey.userId === "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    
    const key = this.generateRedisCompanionKey(companionKey);
    const result = await this.history.zadd(key, {
      score: Date.now(),
      member: text,
    });

    // Optionally store in Pinecone for long-term memory
    // You might want to only store user messages or important assistant responses
    if (storeInPinecone && text.length > 50) {  // Only store substantive messages
      await this.storeMemory(text, companionKey);
    }

    return result;
  }

  /**
   * Read the latest chat history lines for this companion+user.
   * Keeps last 30 entries, in chronological order.
   */
  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey || typeof companionKey.userId === "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    const key = this.generateRedisCompanionKey(companionKey);

    // Read by score (0..now). Fetches all; then keep last 30 below.
    let result = await this.history.zrange(key, 0, Date.now(), {
      byScore: true,
    });

    // Keep last 30, return in chronological order
    result = result.slice(-30);
    const recentChats = result.join("\n");
    return recentChats;
  }

  /**
   * Seed the chat history with initial content, split by `delimiter`,
   * if a history key does not already exist.
   */
  public async seedChatHistory(
    seedContent: string,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ) {
    const key = this.generateRedisCompanionKey(companionKey);

    if (await this.history.exists(key)) {
      console.log("User already has chat history");
      return;
    }

    const content = (seedContent || "").split(delimiter);
    let counter = 0;

    for (const line of content) {
      await this.history.zadd(key, { score: counter, member: line });
      counter += 1;
    }
  }

  /**
   * Clear all memories for a specific user and companion.
   * Useful for privacy compliance or user-requested data deletion.
   */
  public async clearUserMemories(companionKey: CompanionKey) {
    try {
      // Clear Redis history
      const key = this.generateRedisCompanionKey(companionKey);
      await this.history.del(key);

      // Note: Clearing Pinecone vectors requires iterating through the index
      // and deleting vectors by metadata filter, which is more complex.
      // You might want to implement this based on your Pinecone setup.
      
      console.log(`Cleared memories for user ${companionKey.userId} with companion ${companionKey.companionName}`);
      return true;
    } catch (err) {
      console.error("Failed to clear user memories", err);
      return false;
    }
  }
}