import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "../models/Document.js";
import { saveChunksToVectorStore } from "../utils/vectorStore.js";

export const processDocument = async (documentId) => {
  let tempFilePath = null;

  try {
    const doc = await Document.findById(documentId);

    if (!doc) {
      throw new Error("Document not found in MongoDB");
    }

    doc.status = "PROCESSING";
    await doc.save();

    let rawDocs = [];

    if (doc.mimeType === "application/pdf") {
      // Cloudinary URL se PDF download
      const response = await axios.get(doc.filePath, {
        responseType: "arraybuffer",
      });

      // Temporary file
      tempFilePath = path.join(os.tmpdir(), `${doc._id}.pdf`);

      fs.writeFileSync(tempFilePath, response.data);

      // PDFLoader temporary file se PDF read karega
      const loader = new PDFLoader(tempFilePath);

      rawDocs = await loader.load();
    } else if (doc.mimeType === "text/plain") {
      // Cloudinary URL se TXT download
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
  } finally {
    // Temporary PDF delete
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};
