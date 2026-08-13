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
        nResults: 8,
        where: { documentId: documentId.toString() },
      });

      console.log("🔎 DOCUMENT ID:", documentId);
      console.log("🔎 QUERY:", question);
      console.log(
        "📚 RETRIEVED CHUNKS:",
        JSON.stringify(searchResults.documents?.[0], null, 2)
      );
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
    prompt = `You are an AI Document Assistant.

The user has selected an uploaded document. You MUST answer using the document context provided below.

IMPORTANT RULES:
1. Use the provided document context as the primary and only source of truth.
2. Never say that the user has not uploaded a document if document context is available.
3. Never invent information that is not present in the context.
4. If the question asks what the document is about, identify its title, project name, subject, introduction, or other relevant information from the context.
5. If the question asks for the number of pages, look carefully for page markers such as "35 of 35".
6. If the answer cannot be found in the provided context, say clearly that the information could not be found in the retrieved part of the document.
7. Give a direct, natural answer. Do not mention embeddings, ChromaDB, vector search, or internal system details.

DOCUMENT CONTEXT:
${contextText}

USER QUESTION:
${question}

ANSWER:`;
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
