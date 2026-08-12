import axios from "axios";
import { PDFParse } from "pdf-parse";
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
      // Cloudinary se PDF download
      const response = await axios.get(doc.filePath, {
        responseType: "arraybuffer",
      });

      const pdfBuffer = Buffer.from(response.data);

      // pdf-parse v2
      const parser = new PDFParse({
        data: pdfBuffer,
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
    }

    // =========================
    // TXT
    // =========================
    else if (doc.mimeType === "text/plain") {
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
    }

    // =========================
    // Unsupported
    // =========================
    else {
      throw new Error(`Unsupported mimeType: ${doc.mimeType}`);
    }

    // Empty document check
    if (!rawDocs[0]?.pageContent?.trim()) {
      throw new Error("No readable text found in document");
    }

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
    await saveChunksToVectorStore(chunksWithMetadata);

    doc.status = "INDEXED";
    await doc.save();

    console.log(`✅ Document ${documentId} indexed. Chunks: ${chunks.length}`);

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
