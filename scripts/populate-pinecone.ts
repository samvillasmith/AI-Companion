// scripts/populate-pinecone.ts
// Safely populate empty Pinecone index with historical messages
// Run AFTER creating new index: tsx scripts/populate-pinecone.ts

import { PrismaClient } from "@prisma/client";
import { MemoryManager } from "../lib/memory";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function populateIndex() {
  console.log("🚀 Starting safe population of Pinecone index...\n");

  try {
    // Get memory manager instance
    const memoryManager = await MemoryManager.getInstance();

    // Fetch all messages from database
    console.log("📦 Fetching messages from database...");
    const messages = await prisma.message.findMany({
      include: {
        companion: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Found ${messages.length} messages\n`);

    if (messages.length === 0) {
      console.log("No messages to populate. Done!");
      return;
    }

    // Count unique users
    const uniqueUsers = new Set(messages.map(m => m.userId));
    console.log(`Messages from ${uniqueUsers.size} unique users\n`);

    // Process messages one by one (safer but slower)
    console.log("📝 Adding messages to Pinecone (this may take a while)...\n");
    
    let processed = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const companionKey = {
          companionName: message.companion.name,
          modelName: "chatgpt",
          userId: message.userId,
        };

        // Format the message
        const speaker = message.role === 'user' ? 'Human' : message.companion.name;
        const content = `${speaker}: ${message.content}`;

        // Store in Pinecone using the memory manager
        // This will use the new storeMemory function with proper userId
        await memoryManager.storeMemory(content, companionKey);
        
        processed++;
        
        // Progress update every 10 messages
        if (processed % 10 === 0) {
          const progress = Math.round((processed / messages.length) * 100);
          console.log(`Progress: ${processed}/${messages.length} (${progress}%)`);
        }
        
      } catch (error) {
        console.error(`Failed to process message ${message.id}:`, error);
        failed++;
      }

      // Rate limiting - be nice to OpenAI API
      if (processed % 50 === 0) {
        console.log("Pausing for rate limits...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ POPULATION COMPLETE!");
    console.log("=".repeat(50));
    console.log(`Successfully processed: ${processed} messages`);
    console.log(`Failed: ${failed} messages`);
    console.log(`\n🔒 All messages are now properly scoped by userId`);

  } catch (error) {
    console.error("❌ Population failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Simple check before running
async function confirmAndRun() {
  console.log("⚠️  This will ADD messages to your Pinecone index.");
  console.log("⚠️  Make sure you have:");
  console.log("   1. Deleted the old index");
  console.log("   2. Created a new empty index with the same name");
  console.log("   3. Deployed the fixed code to production\n");
  console.log("Press Ctrl+C to cancel, waiting 5 seconds...\n");
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await populateIndex();
}

confirmAndRun().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});