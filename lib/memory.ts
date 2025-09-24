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
  private pinecone?: Pinecone;
  private pineconeIndexName?: string;

  private constructor() {
    this.history = Redis.fromEnv();
    this.pineconeIndexName = process.env.PINECONE_INDEX || undefined;
  }

  private async ensurePinecone() {
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

  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string,
    userId: string
  ) {
    try {
      await this.ensurePinecone();
      const index = this.pinecone!.Index(this.pineconeIndexName!);

      // DON'T CHECK STATS - they're eventually consistent and unreliable!
      // Just try the search - if empty, it returns empty results

      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        model: "text-embedding-ada-002",
      });

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
      });

      const similarDocs = await vectorStore.similaritySearch(
        recentChatHistory,
        3,
        { 
          fileName: companionFileName,
          userId: userId
        }
      );

      console.log(`[MemoryManager] Vector search found ${similarDocs.length} results`);
      return similarDocs;
    } catch (err) {
      console.log("Failed to get vector search results", err);
      return [];
    }
  }

  public async storeMemory(text: string, companionKey: CompanionKey) {
    try {
      await this.ensurePinecone();
      const index = this.pinecone!.Index(this.pineconeIndexName!);

      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        model: "text-embedding-ada-002",
      });

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
      });

      const doc = new Document({
        pageContent: text,
        metadata: {
          fileName: companionKey.companionName,
          userId: companionKey.userId,
          timestamp: Date.now(),
          modelName: companionKey.modelName,
        },
      });

      await vectorStore.addDocuments([doc]);
      console.log(`[MemoryManager] Stored memory for ${companionKey.companionName}`);
      return true;
    } catch (err) {
      console.error("Failed to store memory in Pinecone", err);
      return false;
    }
  }

  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private generateRedisCompanionKey(companionKey: CompanionKey): string {
    return `${companionKey.companionName}-${companionKey.modelName}-${companionKey.userId}`;
  }

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

    // Store important messages in Pinecone
    if (storeInPinecone && text.length > 20) {
      await this.storeMemory(text, companionKey);
    }

    return result;
  }

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey || typeof companionKey.userId === "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    const key = this.generateRedisCompanionKey(companionKey);
    let result = await this.history.zrange(key, 0, Date.now(), { byScore: true });
    result = result.slice(-30);
    const recentChats = result.join("\n");
    return recentChats;
  }

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

  public async clearUserMemories(companionKey: CompanionKey) {
    try {
      const key = this.generateRedisCompanionKey(companionKey);
      await this.history.del(key);
      console.log(`Cleared memories for user ${companionKey.userId} with companion ${companionKey.companionName}`);
      return true;
    } catch (err) {
      console.error("Failed to clear user memories", err);
      return false;
    }
  }
}