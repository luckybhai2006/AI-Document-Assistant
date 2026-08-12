import axios from "axios";
import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "../models/Document.js";
import { saveChunksToVectorStore } from "../utils/vectorStore.js";

export const processDocument = async (documentId) => {
  try {
    const doc = await Document.findById(documentId);

    if (!doc) {
      throw new Error("Document not found in MongoDB");
    }

    doc.status = "PROCESSING";
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

      const pdfBuffer = Buffer.from(response.data);

      console.log("📄 Parsing PDF...");

      const parser = new PDFParse({
        data: new Uint8Array(pdfBuffer),
        CanvasFactory,
      });

      const result = await parser.getText();

      await parser.destroy();

      rawDocs = [
        {
          pageContent: result.text,
          metadata: {
            source: doc.filePath,
          },
        },
      ];

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
    // Unsupported file
    // =========================
    else {
      throw new Error(`Unsupported mimeType: ${doc.mimeType}`);
    }

    // =========================
    // Empty document check
    // =========================
    if (!rawDocs[0]?.pageContent?.trim()) {
      throw new Error("No readable text found in document");
    }

    console.log("📝 Text length:", rawDocs[0].pageContent.length);

    // =========================
    // Split text into chunks
    // =========================
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const rawChunks = await splitter.splitDocuments(rawDocs);

    const chunks = rawChunks.filter(
      (chunk) => chunk.pageContent && chunk.pageContent.trim().length > 0
    );

    console.log("✂️ Chunks created:", chunks.length);

    // =========================
    // Add metadata
    // =========================
    const chunksWithMetadata = chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        userId: doc.userId.toString(),
        documentId: doc._id.toString(),
      },
    }));

    // =========================
    // Save to ChromaDB
    // =========================
    console.log("🧠 Saving chunks to vector store...");

    await saveChunksToVectorStore(chunksWithMetadata);

    // =========================
    // Mark document indexed
    // =========================
    doc.status = "INDEXED";
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
    });

    throw error;
  }
};
// hellow
