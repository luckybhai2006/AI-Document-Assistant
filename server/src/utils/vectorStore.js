import { CloudClient } from "chromadb";
import { getGeminiEmbeddings } from "../config/gemini.js";

const COLLECTION_NAME = "user-docu";

export const saveChunksToVectorStore = async (
  docsWithMetadata,
  onEmbeddingProgress
) => {
  try {
    const embeddingsModel = getGeminiEmbeddings();

    const chromaClient = new CloudClient({
      apiKey: process.env.CHROMA_KEY,
      tenant: process.env.TENANT_KEY,
      database: process.env.DATABASE,
    });

    const collection = await chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: null,
    });

    const texts = docsWithMetadata.map((doc) => doc.pageContent);
    const metadatas = docsWithMetadata.map((doc) => doc.metadata);

    const ids = docsWithMetadata.map(
      (_, index) => `doc_${Date.now()}_${index}`
    );

    console.log(`⏳ Generating ${texts.length} document embeddings...`);

    const embeddings = await embeddingsModel.embedDocuments(
      texts,
      (completed, total) => {
        console.log(`🧠 Embedding ${completed}/${total}`);

        if (onEmbeddingProgress) {
          onEmbeddingProgress(completed, total);
        }
      }
    );

    console.log(`✅ Generated ${embeddings.length} embeddings`);

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
