import axios from "axios";
import { extractText, getDocumentProxy } from "unpdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "../models/Document.js";
import { saveChunksToVectorStore } from "../utils/vectorStore.js";

export const processDocument = async (documentId) => {
  try {
    const doc = await Document.findById(documentId);

    if (!doc) {
      throw new Error("Document not found in MongoDB");
    }
    // =========================
    // Start Processing
    // =========================
    doc.status = "PROCESSING";
    doc.progress = 10;
    await doc.save();

    let rawDocs = [];

    // =========================
    // PDF
    // =========================
    if (doc.mimeType === "application/pdf") {
      console.log("📄 Downloading PDF from Cloudinary...");

      const response = await axios.get(doc.filePath, {
        responseType: "arraybuffer",
      });

      // unpdf ko Uint8Array chahiye, DOMMatrix ya worker file
      // ki koi zaroorat nahi — isliye Vercel serverless pe safe hai
      const pdfBuffer = new Uint8Array(response.data);

      console.log("📄 Parsing PDF...");

      const pdf = await getDocumentProxy(pdfBuffer);
      const { text } = await extractText(pdf, {
        mergePages: false,
      });

      rawDocs = text.map((pageText, index) => ({
        pageContent: pageText,
        metadata: {
          source: doc.filePath,
          page: index + 1,
        },
      }));

      console.log("✅ PDF parsed successfully");
    }

    // =========================
    // TXT
    // =========================
    else if (doc.mimeType === "text/plain") {
      console.log("📄 Downloading TXT from Cloudinary...");

      const response = await axios.get(doc.filePath, {
        responseType: "text",
      });

      rawDocs = [
        {
          pageContent: response.data,
          metadata: {
            source: doc.filePath,
          },
        },
      ];

      console.log("✅ TXT loaded successfully");
    }

    // =========================
    // Unsupported File
    // =========================
    else {
      throw new Error(`Unsupported mimeType: ${doc.mimeType}`);
    }

    // =========================
    // Empty Document Check
    // =========================
    if (!rawDocs[0]?.pageContent?.trim()) {
      throw new Error("No readable text found in document");
    }

    console.log("📝 Text length:", rawDocs[0].pageContent.length);

    // =========================
    // Split Text Into Chunks
    // =========================
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const rawChunks = await splitter.splitDocuments(rawDocs);

    const chunks = rawChunks.filter((chunk) => {
      const text = chunk.pageContent?.trim();

      if (!text) return false;

      const cleanedText = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim();

      return cleanedText.length > 30;
    });

    console.log("✂️ Chunks created:", chunks.length);

    // =========================
    // Parsing Complete
    // =========================
    doc.progress = 50;
    await doc.save();

    // =========================
    // Add Metadata
    // =========================
    const chunksWithMetadata = chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        userId: doc.userId.toString(),
        documentId: doc._id.toString(),
        source: doc.filePath,
        page: chunk.metadata?.page ?? null,
      },
    }));

    // =========================
    // Save To ChromaDB
    // =========================
    console.log("🧠 Saving chunks to vector store...");

    await saveChunksToVectorStore(
      chunksWithMetadata,
      async (completed, total) => {
        const embeddingProgress = 55 + Math.round((completed / total) * 35);

        await Document.findByIdAndUpdate(doc._id, {
          progress: embeddingProgress,
        });

        console.log(
          `📊 Document progress: ${embeddingProgress}% (${completed}/${total})`
        );
      }
    );

    // =========================
    // Finished
    // =========================
    doc.status = "INDEXED";
    doc.progress = 100;
    await doc.save();

    console.log(
      `✅ Document ${documentId} indexed successfully. Chunks: ${chunks.length}`
    );

    return {
      success: true,
      totalChunks: chunks.length,
    };
  } catch (error) {
    console.error("❌ Process Document Service Error:", error.message);

    await Document.findByIdAndUpdate(documentId, {
      status: "FAILED",
      progress: 0,
    });

    throw error;
  }
};
