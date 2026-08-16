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

  // =====================================================
  // 1. QUERY TYPE DETECTION
  // =====================================================

  // Example:
  // "what is written in the 11th page?"
  // "show me page 5"
  // "what is on page 20?"
  const pageMatch = question.match(
    /\b(?:page|pg\.?)\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\s+page\b/i
  );

  const requestedPage = pageMatch ? Number(pageMatch[1] || pageMatch[2]) : null;

  // Example:
  // "give me all emails"
  // "list all names"
  // "find every phone number"
  const isExtractionQuery =
    /\b(all|every|each|list|extract|give me|show me|find all|find every)\b/i.test(
      question
    );

  console.log("========================================");
  console.log("❓ QUESTION:", question);
  console.log("📄 REQUESTED PAGE:", requestedPage);
  console.log("🔍 EXTRACTION QUERY:", isExtractionQuery);
  console.log("========================================");

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

    // =====================================================
    // 2. GENERATE QUESTION VECTOR
    // =====================================================

    // Page query mein vector ki zarurat nahi hai.
    // Baaki queries ke liye generate karenge.
    let queryVector = null;

    if (!requestedPage) {
      queryVector = await embeddingsModel.embedQuery(question);
    }

    // =====================================================
    // 3. SINGLE DOCUMENT
    // =====================================================

    if (documentId) {
      let searchResults;

      // ===================================================
      // MODE A — SPECIFIC PAGE
      // ===================================================

      if (requestedPage) {
        console.log(
          `📄 PAGE MODE - SEARCHING DIRECTLY FOR PAGE ${requestedPage}`
        );

        searchResults = await collection.get({
          where: {
            $and: [
              {
                documentId: documentId.toString(),
              },
              {
                page: requestedPage,
              },
            ],
          },
          include: ["documents", "metadatas"],
        });

        matchingDocs = searchResults.documents || [];
        matchingMetadatas = searchResults.metadatas || [];

        console.log(
          `📚 PAGE ${requestedPage} CHUNKS FOUND:`,
          matchingDocs.length
        );
      }

      // ===================================================
      // MODE B — EXTRACTION / WHOLE DOCUMENT
      // ===================================================
      else if (isExtractionQuery) {
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

      // ===================================================
      // MODE C — NORMAL SEMANTIC SEARCH
      // ===================================================
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
    }

    // =====================================================
    // 4. MULTI DOCUMENT SEARCH
    // =====================================================
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

      console.log("📚 MULTI DOCUMENT CHUNKS:", matchingDocs.length);
    }

    // =====================================================
    // 5. BUILD DOCUMENT CONTEXT
    // =====================================================

    if (matchingDocs.length > 0) {
      contextText = matchingDocs
        .map((text, index) => {
          const metadata = matchingMetadatas[index];

          return `[PAGE ${metadata?.page || "Unknown"}]\n${text}`;
        })
        .join("\n\n");

      console.log("📄 CONTEXT CHUNKS:", matchingDocs.length);
    } else {
      console.log("⚠️ NO DOCUMENT CHUNKS FOUND");
    }
  } catch (err) {
    console.log("⚠️ Vector Search bypassed/failed:", err.message);
  }

  // =====================================================
  // 6. CREATE PROMPT
  // =====================================================

  let prompt = "";

  if (contextText && contextText.trim().length > 20) {
    // ===================================================
    // SPECIFIC PAGE PROMPT
    // ===================================================

    if (requestedPage) {
      prompt = `You are an AI Document Assistant.

The user asked specifically about page ${requestedPage} of the uploaded PDF.

IMPORTANT RULES:

1. Use ONLY the provided document context.
2. The provided context is specifically retrieved for page ${requestedPage}.
3. Answer using the actual content of that page.
4. Do not use information from other pages.
5. Never invent information.
6. If the requested information is not present on this page, clearly say that it could not be found on this page.
7. Answer directly and naturally.
8. Do not mention embeddings, ChromaDB, vector search, metadata, or internal system details.
9. Do not include page numbers in the answer because the application displays them separately.

DOCUMENT CONTEXT:

${contextText}

USER QUESTION:

${question}

ANSWER:`;
    }

    // ===================================================
    // EXTRACTION PROMPT
    // ===================================================
    else if (isExtractionQuery) {
      prompt = `You are an AI Document Assistant.

The user wants information extracted from the uploaded PDF.

The provided context contains the complete retrieved document.

IMPORTANT RULES:

1. Search ALL provided pages before answering.
2. Do NOT answer using only the first or most relevant page.
3. Find EVERY occurrence that matches the user's request.
4. Never invent information.
5. Preserve the exact values found in the document.
6. Remove duplicate values.
7. For every extracted value, determine the page where it actually appears.
8. If the same value appears on multiple pages, include all relevant pages.
9. ONLY include pages that actually contain information supporting the answer.
10. Do NOT include unrelated pages.
11. If nothing matching the question exists, say that nothing was found.
12. Return ONLY valid JSON.
13. Do not use markdown code fences.

The JSON MUST have exactly this structure:

{
  "answer": "Your natural language answer containing all extracted values.",
  "pages": [2, 5]
}

The "pages" array MUST contain ONLY the page numbers that actually contain the extracted information.

DOCUMENT CONTEXT:

${contextText}

USER QUESTION:

${question}

JSON RESPONSE:`;
    }

    // ===================================================
    // NORMAL QUESTION PROMPT
    // ===================================================
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
    // ===================================================
    // GENERAL AI MODE
    // ===================================================

    prompt = `You are a helpful AI assistant.

Answer the user's question clearly and naturally.

USER QUESTION:

${question}

ANSWER:`;
  }

  // =====================================================
  // 7. GEMINI
  // =====================================================

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
  });

  const resultStream = await model.generateContentStream(prompt);

  // =====================================================
  // 8. RECEIVE GEMINI RESPONSE
  // =====================================================

  let fullAiText = "";

  for await (const chunk of resultStream.stream) {
    const chunkText = chunk.text();

    if (chunkText) {
      fullAiText += chunkText;
    }
  }

  // =====================================================
  // 9. SPECIFIC PAGE RESPONSE
  // =====================================================

  if (requestedPage && contextText) {
    // Direct page query hai,
    // isliye source sirf requested page hoga.

    sources = [
      ...new Map(
        matchingMetadatas
          .filter((metadata) => Number(metadata?.page) === requestedPage)
          .map((metadata) => ({
            page: metadata?.page || null,
            source: metadata?.source || null,
          }))
          .filter((source) => source.page || source.source)
          .map((source) => [`${source.source}-${source.page}`, source])
      ).values(),
    ];

    onChunk(fullAiText);
  }

  // =====================================================
  // 10. EXTRACTION RESPONSE
  // =====================================================
  else if (isExtractionQuery && contextText) {
    try {
      const cleanedResponse = fullAiText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsedResponse = JSON.parse(cleanedResponse);

      // -----------------------------------------------
      // SEND ANSWER TO UI
      // -----------------------------------------------

      if (parsedResponse.answer) {
        onChunk(parsedResponse.answer);
      }

      // -----------------------------------------------
      // ONLY RELEVANT PAGES
      // -----------------------------------------------

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

      sources = [];
    }
  }

  // =====================================================
  // 11. NORMAL RESPONSE
  // =====================================================
  else {
    onChunk(fullAiText);

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

  // =====================================================
  // 12. FINAL RESULT
  // =====================================================

  console.log("📚 FINAL SOURCES:", JSON.stringify(sources, null, 2));

  return {
    answer: fullAiText,
    sources,
  };
};
