import { CloudClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiEmbeddings } from "../config/gemini.js";
import { saveMessageToHistory } from "../controllers/chat.controller.js";
import dotenv from "dotenv";

dotenv.config();

const dummyEmbeddingFunction = {
  generate: async () => [],
};

export const streamAnswerFromDocs = async (params, onChunk) => {
  const { userId, documentId, multiDocIds, question } = params;

  let contextText = "";

  try {
    const embeddingsModel = getGeminiEmbeddings();

    const chromaClient = new CloudClient({
      apiKey: process.env.CHROMA_KEY,
      tenant: process.env.TENANT_KEY,
      database: process.env.DATABASE,
    });

    const collection = await chromaClient.getCollection({
      name: "user-docu",
      embeddingFunction: dummyEmbeddingFunction,
    });

    // 1. Generate Question Query Vector
    const queryVector = await embeddingsModel.embedQuery(question);

    let matchingDocs = [];

    // Mode A: Single Selected Document Search
    if (documentId) {
      const searchResults = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: 4,
        where: { documentId: documentId.toString() },
      });
      matchingDocs = searchResults.documents[0] || [];
    }
    // Mode B: Multi-Document Search (If multiple doc IDs passed)
    else if (
      multiDocIds &&
      Array.isArray(multiDocIds) &&
      multiDocIds.length > 0
    ) {
      const searchResults = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: 6,
        where: { userId: userId.toString() },
      });
      matchingDocs = searchResults.documents[0] || [];
    }

    // Combine extracted chunks
    if (matchingDocs.length > 0) {
      contextText = matchingDocs.join("\n\n");
    }
  } catch (err) {
    console.log(
      "⚠️ Vector Search bypassed/failed, falling back to General AI Mode:",
      err.message
    );
  }

  // 2. Dynamic Adaptive Prompt Architecture
  let prompt = "";

  if (contextText && contextText.trim().length > 20) {
    // Mode 1: Strict PDF Document Context
    prompt = `You are an expert AI Document Assistant.
Answer the user's question accurately based on the document context provided below.

CONTEXT:
${contextText}

USER QUESTION:
${question}`;
  } else {
    // Mode 2: General Intelligent AI Mode (ChatGPT/Gemini Style)
    prompt = `You are an advanced, helpful, and highly intelligent AI Assistant.
The user's question is general or not found in their current documents. Answer the user comprehensively, directly, and naturally.

USER QUESTION:
${question}`;
  }

  // 3. Gemini Stream Generation
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
  // Using gemini-2.5-flash for real-time low latency SSE streaming
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const resultStream = await model.generateContentStream(prompt);

  // 🔴 CHANGE 1: Variable to store full AI response text
  let fullAiText = "";

  for await (const chunk of resultStream.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      fullAiText += chunkText; // 🔴 CHANGE 2: Append chunk
      onChunk(chunkText); // Stream token to SSE response
    }
  }
};
