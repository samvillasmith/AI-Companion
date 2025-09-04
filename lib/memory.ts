/* memoryManager.ts

Purpose: Provide a simple "memory" layer for an AI companion.
- Short-term memory: chat history stored in Upstash Redis (as a sorted set).
- Long-term memory: semantic recall via Pinecone + LangChain similarity search.

Requirements (env):

- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (for Redis.fromEnv())
- PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX (for Pinecone)
- OPENAI_API_KEY (for embedding generation) */ 

import { Redis } from "@upstash/redis";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  private static instance: MemoryManager;
  private history: Redis;
  private vectorDBClient: PineconeClient;

  public constructor() {
    // Initialize Redis from environment variables
    this.history = Redis.fromEnv();
  }

  /**
   * Initialize Pinecone client using environment variables.
   * IMPORTANT: This will only run if `this.vectorDBClient` is already an instance of PineconeClient.
   */
  public async init() {
    if (this.vectorDBClient instanceof PineconeClient) {
      await this.vectorDBClient.init({
        apiKey: process.env.PINECONE_API_KEY!,
        environment: process.env.PINECONE_ENVIRONMENT!,
      });
    }
  }

  /**
   * Perform a similarity search against the existing Pinecone index using
   * OpenAI embeddings. Filters by `fileName` metadata.
   *
   * @param recentChatHistory - The query text (e.g., recent messages).
   * @param companionFileName - The metadata `fileName` to filter results by.
   */
  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string
  ) {
    // Cast to PineconeClient 
    const pineconeClient = <PineconeClient>this.vectorDBClient;

    // Use configured index 
    const pineconeIndex = pineconeClient.Index(
      process.env.PINECONE_INDEX || ""
    );

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      { pineconeIndex }
    );

    // Top-3 most similar docs, filtered by fileName metadata
    const similarDocs = await vectorStore
      .similaritySearch(recentChatHistory, 3, { fileName: companionFileName })
      .catch((err) => {
        console.log("Failed to get vector search results", err);
      });

    return similarDocs;
  }

  /**
   * Get or create the singleton instance of MemoryManager.
   * Calls `init()` after constructing the instance.
   */
  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
      await MemoryManager.instance.init();
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
   */
  public async writeToHistory(text: string, companionKey: CompanionKey) {
    if (!companionKey || typeof companionKey.userId === "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    const key = this.generateRedisCompanionKey(companionKey);
    const result = await this.history.zadd(key, {
      score: Date.now(),
      member: text,
    });
    return result;
  }

 
    // Read the latest chat history lines for this companion+user.

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey || typeof companionKey.userId === "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    const key = this.generateRedisCompanionKey(companionKey);

    // Read by score (0..now). This fetches all, then we keep last 30 below.
    // (Original numeric bounds preserved.)
    // eslint-disable-next-line prefer-const
    let result = await this.history.zrange(key, 0, Date.now(), {
      byScore: true,
    });

    // Keep last 30, reverse to get newest-first...
    result = result.slice(-30).reverse();
    // ...then reverse again to return oldest-first (chronological).
    const recentChats = result.reverse().join("\n");
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

    const content = seedContent.split(delimiter);
    // eslint-disable-next-line prefer-const
    let counter = 0;

    for (const line of content) {
      await this.history.zadd(key, { score: counter, member: line });
      counter += 1;
    }
  }
}
