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

  // =========================
  // EXTRACTION QUERY CHECK
  // =========================
  const isExtractionQuery =
    /\b(all|every|each|list|extract|give me|show me|find all|find every)\b/i.test(
      question
    );

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
    // 2. SINGLE DOCUMENT
    // =========================
    if (documentId) {
      let searchResults;

      // =========================
      // EXTRACTION MODE
      // =========================
      if (isExtractionQuery) {
        console.log("🔍 EXTRACTION MODE - SEARCHING WHOLE DOCUMENT");

        searchResults = await collection.get({
          where: {
            documentId: documentId.toString(),
          },
          include: ["documents", "metadatas"],
        });

        matchingDocs = searchResults.documents || [];
        matchingMetadatas = searchResults.metadatas || [];

        console.log("📚 TOTAL DOCUMENT CHUNKS:", matchingDocs.length);
      }

      // =========================
      // NORMAL MODE
      // =========================
      else {
        console.log("🔍 NORMAL MODE - SEARCHING RELEVANT CHUNK");

        searchResults = await collection.query({
          queryEmbeddings: [queryVector],
          nResults: 1,
          where: {
            documentId: documentId.toString(),
          },
        });

        matchingDocs = searchResults.documents?.[0] || [];
        matchingMetadatas = searchResults.metadatas?.[0] || [];

        console.log("📚 RETRIEVED CHUNKS:", matchingDocs.length);
      }

      console.log("🔎 DOCUMENT ID:", documentId);
      console.log("🔎 QUESTION:", question);
    }

    // =========================
    // 3. MULTI DOCUMENT SEARCH
    // =========================
    else if (
      multiDocIds &&
      Array.isArray(multiDocIds) &&
      multiDocIds.length > 0
    ) {
      console.log("🔍 MULTI DOCUMENT MODE");

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
    // 4. BUILD CONTEXT
    // =========================
    if (matchingDocs.length > 0) {
      contextText = matchingDocs
        .map((text, index) => {
          const metadata = matchingMetadatas[index];

          return `[PAGE ${metadata?.page || "Unknown"}]\n${text}`;
        })
        .join("\n\n");

      console.log("📄 CONTEXT CHUNKS:", matchingDocs.length);
    }
  } catch (err) {
    console.log("⚠️ Vector Search bypassed/failed:", err.message);
  }

  // =========================
  // 5. CREATE PROMPT
  // =========================
  let prompt = "";

  if (contextText && contextText.trim().length > 20) {
    // =====================================================
    // EXTRACTION PROMPT
    // =====================================================
    if (isExtractionQuery) {
      prompt = `You are an AI Document Assistant.

The user wants information extracted from the uploaded document.

You have been given the COMPLETE retrieved document context.

IMPORTANT RULES:

1. Search ALL provided pages before answering.
2. Do NOT answer using only the first or most relevant page.
3. Find EVERY occurrence that matches the user's request.
4. Never invent information.
5. Preserve the exact values found in the document.
6. Remove duplicate values.
7. For every extracted value, identify the page where it appears.
8. If the same value appears on multiple pages, include all relevant pages.
9. Only include pages that actually contain information relevant to the answer.
10. Do not include unrelated pages.
11. If nothing matching the question exists, say that nothing was found.
12. Return ONLY valid JSON.
13. Do not use markdown code fences.

The JSON MUST have exactly this structure:

{
  "answer": "Your natural language answer containing all extracted values.",
  "pages": [2, 6]
}

The "pages" array MUST contain ONLY the page numbers that actually support the answer.

DOCUMENT CONTEXT:

${contextText}

USER QUESTION:

${question}

JSON RESPONSE:`;
    }

    // =====================================================
    // NORMAL QUESTION PROMPT
    // =====================================================
    else {
      prompt = `You are an AI Document Assistant.

The user has selected an uploaded document.

IMPORTANT RULES:

1. Use the provided document context as the primary and only source of truth.
2. Never invent information.
3. Answer directly and naturally.
4. If the answer cannot be found in the provided context, clearly say that it could not be found.
5. Do not mention embeddings, ChromaDB, vector search, metadata, or internal system details.
6. Do not include page numbers in the answer.

DOCUMENT CONTEXT:

${contextText}

USER QUESTION:

${question}

ANSWER:`;
    }
  } else {
    // =========================
    // GENERAL AI MODE
    // =========================
    prompt = `You are a helpful AI assistant.

Answer the user's question clearly and naturally.

USER QUESTION:

${question}

ANSWER:`;
  }

  // =========================
  // 6. GEMINI
  // =========================
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
  });

  const resultStream = await model.generateContentStream(prompt);

  // =========================
  // 7. RECEIVE GEMINI RESPONSE
  // =========================
  let fullAiText = "";

  for await (const chunk of resultStream.stream) {
    const chunkText = chunk.text();

    if (chunkText) {
      fullAiText += chunkText;
    }
  }

  // =====================================================
  // 8. EXTRACTION RESPONSE
  // =====================================================
  if (isExtractionQuery && contextText) {
    try {
      const cleanedResponse = fullAiText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsedResponse = JSON.parse(cleanedResponse);

      // =========================
      // SEND ONLY ANSWER TO UI
      // =========================
      if (parsedResponse.answer) {
        onChunk(parsedResponse.answer);
      }

      // =========================
      // FIND ONLY RELEVANT PAGES
      // =========================
      if (
        Array.isArray(parsedResponse.pages) &&
        parsedResponse.pages.length > 0
      ) {
        const relevantPages = new Set(
          parsedResponse.pages.map((page) => Number(page))
        );

        sources = [
          ...new Map(
            matchingMetadatas
              .filter((metadata) => relevantPages.has(Number(metadata?.page)))
              .map((metadata) => ({
                page: metadata?.page || null,
                source: metadata?.source || null,
              }))
              .filter((source) => source.page || source.source)
              .map((source) => [`${source.source}-${source.page}`, source])
          ).values(),
        ];
      }
    } catch (error) {
      console.error("❌ Extraction JSON Parse Error:", error.message);

      // Fallback
      onChunk(fullAiText);

      // Agar Gemini JSON nahi deta,
      // saare sources nahi bhejenge blindly.
      sources = [];
    }
  }

  // =====================================================
  // 9. NORMAL RESPONSE
  // =====================================================
  else {
    onChunk(fullAiText);

    // Normal query mein retrieved page(s)
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
  }

  // =========================
  // 10. FINAL RESULT
  // =========================
  console.log("📚 FINAL SOURCES:", JSON.stringify(sources, null, 2));

  return {
    answer: fullAiText,
    sources,
  };
};
