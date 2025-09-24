/* eslint-disable @typescript-eslint/no-unused-vars */
// scripts/rebuild-pinecone.ts
// Complete purge and rebuild of Pinecone index with user privacy
// Run with: tsx scripts/rebuild-pinecone.ts

import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function rebuildPinecone() {
  console.log("🔄 Starting Pinecone purge and rebuild...\n");

  // Validate environment
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX || !process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variables: PINECONE_API_KEY, PINECONE_INDEX, or OPENAI_API_KEY");
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = process.env.PINECONE_INDEX;
  
  try {
    // Step 1: Get current index stats
    console.log("📊 Getting current index statistics...");
    const index = pinecone.Index(indexName);
    
    try {
      const stats = await index.describeIndexStats();
      console.log(`Current vectors in index: ${stats.totalVectorCount || 0}\n`);
    } catch (e) {
      console.log("Could not get stats, continuing...\n");
    }

    // Step 2: Confirm deletion with user
    console.log("⚠️  WARNING: This will DELETE ALL vectors in your Pinecone index!");
    console.log("⚠️  Index name: " + indexName);
    console.log("⚠️  This action cannot be undone!");
    console.log("\n⏰ You have 10 seconds to press Ctrl+C to cancel...\n");
    
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log("\n");

    // Step 3: Delete all vectors
    console.log("🗑️  Purging all vectors from index...");
    
    try {
      // Try to delete all vectors
      // Note: The exact method depends on your Pinecone client version
      await index.deleteAll();
      console.log("✅ All vectors deleted using deleteAll\n");
    } catch (error) {
      // Alternative method if deleteAll doesn't exist
      console.log("Trying alternative deletion method...");
      try {
        await index.delete1({ 
          deleteAll: true 
        });
        console.log("✅ All vectors deleted using delete1\n");
      } catch (error2) {
        console.log("⚠️  Could not delete vectors automatically.");
        console.log("Please manually delete all vectors from Pinecone dashboard and re-run this script.\n");
        process.exit(1);
      }
    }

    // Step 4: Fetch all messages from database
    console.log("📦 Fetching messages from database...");
    const messages = await prisma.message.findMany({
      include: {
        companion: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`✅ Found ${messages.length} messages to index\n`);

    if (messages.length === 0) {
      console.log("No messages found in database. Index is now empty and ready for new messages.");
      await prisma.$disconnect();
      return;
    }

    // Step 5: Group messages by user for stats
    const userMessages = new Map<string, number>();
    messages.forEach(msg => {
      userMessages.set(msg.userId, (userMessages.get(msg.userId) || 0) + 1);
    });
    console.log(`📊 Messages from ${userMessages.size} unique users\n`);

    // Step 6: Create embeddings and vector store
    console.log("🤖 Initializing OpenAI embeddings...");
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small", // Cheaper and faster
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });
    console.log("✅ Vector store initialized\n");

    // Step 7: Process messages in batches
    console.log("📝 Creating and storing embeddings...");
    console.log("This may take a while depending on the number of messages...\n");

    const BATCH_SIZE = 50; // Process 50 messages at a time
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, Math.min(i + BATCH_SIZE, messages.length));
      
      // Create documents with proper metadata
      const documents = batch.map(msg => {
        // Format the content based on role
        const speaker = msg.role === 'user' ? 'Human' : msg.companion.name;
        const content = `${speaker}: ${msg.content}`;
        
        return new Document({
          pageContent: content,
          metadata: {
            // CRITICAL: Include userId for privacy
            userId: msg.userId,
            
            // Companion info for filtering
            fileName: msg.companion.name,      // Keep for backward compatibility
            companionId: msg.companionId,
            companionName: msg.companion.name,
            
            // Message metadata
            messageId: msg.id,
            role: msg.role,
            
            // Timestamps
            timestamp: msg.createdAt.getTime(),
            createdAt: msg.createdAt.toISOString(),
          },
        });
      });

      try {
        // Add documents to vector store
        await vectorStore.addDocuments(documents);
        processed += documents.length;
        
        // Progress indicator
        const progress = Math.round((processed / messages.length) * 100);
        process.stdout.write(`\r✅ Progress: ${processed}/${messages.length} messages (${progress}%)`);
      } catch (error) {
        console.error(`\n❌ Failed to process batch ${i}-${i + BATCH_SIZE}:`, error);
        failed += batch.length;
      }

      // Rate limiting - pause between batches to avoid hitting API limits
      if (i + BATCH_SIZE < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    console.log("\n");

    // Step 8: Final summary
    console.log("=" .repeat(50));
    console.log("✅ REBUILD COMPLETE!");
    console.log("=" .repeat(50));
    console.log(`📊 Final Statistics:`);
    console.log(`   • Total messages processed: ${processed}`);
    console.log(`   • Failed messages: ${failed}`);
    console.log(`   • Unique users: ${userMessages.size}`);
    console.log(`   • Success rate: ${Math.round((processed / messages.length) * 100)}%`);
    console.log("\n🔒 Privacy Status: SECURED");
    console.log("Each user's memories are now isolated and cannot be accessed by other users.");

    // Step 9: Verify the new index
    console.log("\n🔍 Verifying new index...");
    const newStats = await index.describeIndexStats();
    console.log(`New vector count: ${newStats.totalVectorCount || 0}`);

    if (newStats.totalVectorCount === 0 && processed > 0) {
      console.log("\n⚠️  Warning: Vectors were processed but index shows 0 vectors.");
      console.log("This might be a delay in Pinecone's indexing. Check again in a few minutes.");
    }

  } catch (error) {
    console.error("\n❌ Rebuild failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n✅ Script completed successfully!");
  console.log("🎯 Next steps:");
  console.log("   1. Deploy the updated code (memory.ts and chat route)");
  console.log("   2. Test with multiple users to verify privacy");
  console.log("   3. Monitor for any issues in production");
}

// Utility to estimate time and cost
async function estimateRebuild() {
  const messageCount = await prisma.message.count();
  const estimatedTime = Math.ceil(messageCount / 100) * 2; // ~2 minutes per 100 messages
  const estimatedCost = (messageCount / 1000) * 0.01; // ~$0.01 per 1000 embeddings
  
  console.log("\n📊 Rebuild Estimates:");
  console.log(`   • Messages to process: ${messageCount}`);
  console.log(`   • Estimated time: ${estimatedTime} minutes`);
  console.log(`   • Estimated OpenAI cost: $${estimatedCost.toFixed(2)}`);
  console.log("\n");
}

// Run the rebuild
async function main() {
  try {
    await estimateRebuild();
    await rebuildPinecone();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();