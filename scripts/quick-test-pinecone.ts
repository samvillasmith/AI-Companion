// scripts/quick-test-pinecone.ts
import { MemoryManager } from "../lib/memory";
import * as dotenv from "dotenv";

dotenv.config();

async function quickTest() {
  console.log("🚀 Quick Pinecone Test\n");
  
  const manager = await MemoryManager.getInstance();
  
  // Test data
  const testKey = {
    companionName: "TestBot",
    modelName: "gpt-4",
    userId: "test_user_123"
  };
  
  // Store test messages
  console.log("📝 Storing test messages...");
  await manager.storeMemory("Human: Hello TestBot, how are you today?", testKey);
  await manager.storeMemory("TestBot: I'm doing great! How can I help you?", testKey);
  await manager.storeMemory("Human: Tell me about AI", testKey);
  await manager.storeMemory("TestBot: AI is fascinating technology that enables machines to learn from data and make intelligent decisions.", testKey);
  
  console.log("✅ Test messages stored!");
  console.log("\nWait 2 seconds for indexing...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test search
  console.log("\n🔍 Testing search...");
  const results = await manager.vectorSearch(
    "tell me about AI",
    "TestBot",
    "test_user_123"
  );
  
  console.log(`Found ${results.length} results:`);
  results.forEach(doc => {
    console.log(`- ${doc.pageContent.substring(0, 100)}...`);
  });
}

quickTest().catch(console.error);