// scripts/direct-test.ts
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

async function directTest() {
  console.log("🚀 Direct Pinecone Test (bypassing LangChain)\n");
  
  // Initialize
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  // Create embedding directly
  console.log("Creating embedding...");
  const response = await openai.embeddings.create({
    input: "Hello TestBot, how are you today?",
    model: "text-embedding-ada-002",
    // NO dimensions parameter!
  });
  
  const embedding = response.data[0].embedding;
  console.log(`✅ Created embedding with ${embedding.length} dimensions`);
  
  // Store in Pinecone
  console.log("\nStoring in Pinecone...");
  await index.upsert([
    {
      id: `test-${Date.now()}`,
      values: embedding,
      metadata: {
        text: "Hello TestBot, how are you today?",
        fileName: "TestBot",
        userId: "test_user_123",
        timestamp: Date.now(),
      },
    },
  ]);
  console.log("✅ Stored successfully!");
  
  // Query
  console.log("\nQuerying...");
  const queryResponse = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });
  
  console.log(`Found ${queryResponse.matches?.length || 0} matches`);
  queryResponse.matches?.forEach(match => {
    console.log(`- Score: ${match.score}, Text: ${match.metadata?.text}`);
  });
}

directTest().catch(console.error);