import { CloudClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiEmbeddings } from "../config/gemini.js";
import dotenv from "dotenv";

dotenv.config();

const dummyEmbeddingFunction = {
  generate: async () => [],
};

export const streamAnswerFromDocs = async (params, onChunk) => {
  const { userId, documentId, multiDocIds, question } = params;

  let contextText = "";
  let matchingDocs = [];
  let matchingMetadatas = [];
  let sources = [];

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

    // =========================
    // 1. Generate Question Vector
    // =========================
    const queryVector = await embeddingsModel.embedQuery(question);

    // =========================
    // Mode A: Single Selected Document
    // =========================
    if (documentId) {
      const searchResults = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: 1,
        where: {
          documentId: documentId.toString(),
        },
      });

      console.log("🔎 DOCUMENT ID:", documentId);
      console.log("🔎 QUERY:", question);

      console.log(
        "📚 RETRIEVED CHUNKS:",
        JSON.stringify(searchResults.documents?.[0], null, 2)
      );

      console.log(
        "📄 RETRIEVED METADATA:",
        JSON.stringify(searchResults.metadatas?.[0], null, 2)
      );

      matchingDocs = searchResults.documents?.[0] || [];
      matchingMetadatas = searchResults.metadatas?.[0] || [];
    }

    // =========================
    // Mode B: Multi-Document Search
    // =========================
    else if (
      multiDocIds &&
      Array.isArray(multiDocIds) &&
      multiDocIds.length > 0
    ) {
      const searchResults = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: 8,
        where: {
          userId: userId.toString(),
        },
      });

      matchingDocs = searchResults.documents?.[0] || [];
      matchingMetadatas = searchResults.metadatas?.[0] || [];
    }

    // =========================
    // 2. Combine Chunks + Page Metadata
    // =========================
    if (matchingDocs.length > 0) {
      contextText = matchingDocs
        .map((text, index) => {
          const metadata = matchingMetadatas[index];

          return `[Page ${metadata?.page || "Unknown"}]\n${text}`;
        })
        .join("\n\n");

      // =========================
      // 3. Prepare Sources
      // =========================
      sources = [
        ...new Map(
          matchingMetadatas
            .map((metadata) => ({
              page: metadata?.page || null,
              source: metadata?.source || null,
            }))
            .filter((source) => source.page || source.source)
            .map((source) => [`${source.source}-${source.page}`, source])
        ).values(),
      ];

      console.log("METADATA LENGTH:", matchingMetadatas.length);
      console.log("📚 SOURCES:", JSON.stringify(sources, null, 2));
    }
  } catch (err) {
    console.log(
      "⚠️ Vector Search bypassed/failed, falling back to General AI Mode:",
      err.message
    );
  }

  // =========================
  // 4. Dynamic Prompt
  // =========================
  let prompt = "";

  if (contextText && contextText.trim().length > 20) {
    prompt = `You are an AI Document Assistant.

The user has selected an uploaded document. You MUST answer using the document context provided below.

IMPORTANT RULES:
1. Use the provided document context as the primary and only source of truth.
2. Never say that the user has not uploaded a document if document context is available.
3. Never invent information that is not present in the context.
4. If the question asks what the document is about, identify its title, project name, subject, introduction, or other relevant information from the context.
5. If the question asks for the number of pages, look carefully for page markers such as "35 of 35".
6. If the answer cannot be found in the provided context, say clearly that the information could not be found in the retrieved part of the document.
7. Give a direct, natural answer.
8. Do not mention embeddings, ChromaDB, vector search, metadata, or internal system details.
9. Do not include page numbers in your answer. Page numbers will be displayed separately by the application.

DOCUMENT CONTEXT:
${contextText}

USER QUESTION:
${question}

ANSWER:`;
  } else {
    // General AI Mode
    prompt = `You are a helpful AI assistant.

Answer the user's question clearly and naturally.

USER QUESTION:
${question}

ANSWER:`;
  }

  // 5. Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
  });

  const resultStream = await model.generateContentStream(prompt);

  // 6. Store Full AI Response
  let fullAiText = "";

  // 7. Stream AI Response
  for await (const chunk of resultStream.stream) {
    const chunkText = chunk.text();

    if (chunkText) {
      fullAiText += chunkText;

      // Send chunk to controller
      onChunk(chunkText);
    }
  }

  // 8. Return Answer + Sources
  return {
    answer: fullAiText,
    sources,
  };
};
