import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "../models/Document.js";
import { saveChunksToVectorStore } from "../utils/vectorStore.js";

export const processDocument = async (documentId) => {
  try {
    const doc = await Document.findById(documentId);
    if (!doc) throw new Error("Document not found in MongoDB");

    doc.status = "PROCESSING";
    await doc.save();

    let rawDocs = [];

    if (doc.mimeType === "application/pdf") {
      const loader = new PDFLoader(doc.filePath);
      rawDocs = await loader.load();
    } else if (doc.mimeType === "text/plain") {
      // Plain text ko direct object mapping se process karein
      const textContent = fs.readFileSync(doc.filePath, "utf-8");
      rawDocs = [
        {
          pageContent: textContent,
          metadata: { source: doc.filePath },
        },
      ];
    } else {
      throw new Error(`Unsupported mimeType: ${doc.mimeType}`);
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const rawChunks = await splitter.splitDocuments(rawDocs);
    const chunks = rawChunks.filter(
      (chunk) => chunk.pageContent && chunk.pageContent.trim().length > 0
    );

    const chunksWithMetadata = chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        userId: doc.userId.toString(),
        documentId: doc._id.toString(),
      },
    }));

    await saveChunksToVectorStore(chunksWithMetadata);

    doc.status = "INDEXED";
    await doc.save();

    return { success: true, totalChunks: chunks.length };
  } catch (error) {
    console.error("❌ Process Document Service Error:", error.message);
    await Document.findByIdAndUpdate(documentId, { status: "FAILED" });
    throw error;
  }
};
