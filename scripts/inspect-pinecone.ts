// scripts/inspect-pinecone.ts
import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";

dotenv.config();

async function inspectIndex() {
  console.log("🔍 Inspecting Pinecone Index...\n");

  try {
    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const indexName = process.env.PINECONE_INDEX!;
    const index = pinecone.Index(indexName);

    // 1. Get index stats
    console.log("📊 Index Statistics:");
    const stats = await index.describeIndexStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 2. Query for random vectors to see what's stored
    console.log("🎲 Fetching sample vectors...");
    
    // Create a proper dimension vector based on stats
    const dimension = stats.dimension || 1536;
    const queryVector = new Array(dimension).fill(0.1);
    
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 10,
      includeMetadata: true,
      includeValues: false,
    });

    console.log(`\nFound ${queryResponse.matches?.length || 0} matches:\n`);

    // Display the metadata of retrieved vectors
    queryResponse.matches?.forEach((match, i) => {
      console.log(`\n--- Match ${i + 1} ---`);
      console.log(`ID: ${match.id}`);
      console.log(`Score: ${match.score}`);
      console.log(`Metadata:`, JSON.stringify(match.metadata, null, 2));
    });

    // 3. Check for specific user's data
    const testUserId = "test_user_123"; // Our test user
    console.log(`\n\n🔍 Searching for user: ${testUserId}`);
    
    const userQuery = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
      filter: { userId: testUserId },
    });

    if (userQuery.matches?.length) {
      console.log(`Found ${userQuery.matches.length} vectors for user ${testUserId}`);
      userQuery.matches.forEach(match => {
        console.log(`- ${match.metadata?.fileName}: ${match.id}`);
      });
    } else {
      console.log(`No vectors found for user ${testUserId}`);
    }

    // 4. List unique companions and users
    console.log("\n\n📝 Analyzing metadata diversity...");
    const companions = new Set<string>();
    const users = new Set<string>();
    
    // Query more vectors to get a better sample
    const sampleQuery = await index.query({
      vector: queryVector,
      topK: 100,
      includeMetadata: true,
    });

    sampleQuery.matches?.forEach(match => {
      if (match.metadata?.fileName) companions.add(match.metadata.fileName as string);
      if (match.metadata?.userId) users.add(match.metadata.userId as string);
    });

    console.log(`\nUnique companions found: ${Array.from(companions).slice(0, 10).join(", ")}...`);
    console.log(`Unique users found: ${users.size}`);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the inspection
inspectIndex().catch(console.error);