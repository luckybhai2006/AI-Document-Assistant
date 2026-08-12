import dotenv from "dotenv";
dotenv.config();
import { CloudClient } from "chromadb";

async function testConnection() {
  try {
    console.log("⏳ Connecting to Chroma Cloud...");

    const chromaClient = new CloudClient({
      apiKey: process.env.CHROMA_KEY,
      tenant: process.env.TENANT_KEY,
      database: process.env.DATABASE,
    });

    // Explicitly create/get collection directly using Chroma SDK
    const collection = await chromaClient.getOrCreateCollection({
      name: "user_documents",
    });

    console.log(
      "✅ SUCCESS! Collection connected/created automatically in Chroma Cloud."
    );
    console.log("Collection Name:", collection.name);

    // Test inserting a simple dummy vector
    await collection.add({
      ids: ["test_id_1"],
      documents: [
        "This is a test document to verify Chroma Cloud integration.",
      ],
      embeddings: [new Array(768).fill(0.1)], // 768-dim dummy vector
    });

    console.log(
      "✅ SUCCESS! Dummy vector inserted into Chroma Cloud successfully."
    );
  } catch (error) {
    console.error("❌ CHROMA CLOUD CONNECTION FAILED:");
    console.error(error);
  }
}

testConnection();
