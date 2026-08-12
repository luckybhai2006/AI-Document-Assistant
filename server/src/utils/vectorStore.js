import { CloudClient } from "chromadb";
import { getGeminiEmbeddings } from "../config/gemini.js";

export const saveChunksToVectorStore = async (docsWithMetadata) => {
  try {
    const embeddingsModel = getGeminiEmbeddings();

    // 1. Connect to Chroma Cloud
    const chromaClient = new CloudClient({
      apiKey: process.env.CHROMA_KEY,
      tenant: process.env.TENANT_KEY,
      database: process.env.DATABASE,
    });

    // 2. Fetch/Create collection (Fresh v2 collection to reset dimension schema)
    const collection = await chromaClient.getOrCreateCollection({
      name: "user-docu",
      embeddingFunction: null, // Disables default embedding warning
    });

    const texts = docsWithMetadata.map((doc) => doc.pageContent);
    const metadatas = docsWithMetadata.map((doc) => doc.metadata);
    const ids = docsWithMetadata.map(
      (_, index) => `doc_${Date.now()}_chunk_${index}`
    );

    console.log("⏳ Generating 768-dim Gemini embeddings for chunks...");
    const embeddings = await embeddingsModel.embedDocuments(texts);

    console.log("⏳ Upserting vectors into Chroma Cloud...");
    await collection.add({
      ids,
      documents: texts,
      embeddings,
      metadatas,
    });

    console.log("✅ Vectors successfully saved to Chroma Cloud!");
    return true;
  } catch (error) {
    console.error("❌ Vector store error:", error.message);
    throw new Error(`Failed to save vectors to Chroma Cloud: ${error.message}`);
  }
};
