import { Document } from "../models/Document.js";
import { processDocument } from "../services/document.service.js";
import { Chat } from "../models/Chat.js";
import { CloudClient } from "chromadb";
import fs from "fs";

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.userId || req.user._id; // 🟢 consistent

    // 1. Create document entry with default status 'PENDING'
    const newDocument = await Document.create({
      userId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
      status: "PENDING",
    });

    console.log(`⏳ Processing document ID: ${newDocument._id}...`);

    // 2. Await processDocument execution completely
    const result = await processDocument(newDocument._id);

    // 3. Fetch the updated document from MongoDB to verify status change
    const updatedDocument = await Document.findById(newDocument._id);

    return res.status(201).json({
      message: "File uploaded and indexed successfully into Chroma Cloud",
      document: updatedDocument,
      chunksIndexed: result.totalChunks,
    });
  } catch (error) {
    console.error("❌ Document ingestion/indexing failed:", error.message);
    return res.status(500).json({
      message: "Upload or indexing failed",
      error: error.message,
    });
  }
};

// User ke saare uploaded documents fetch karne ke liye
export const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id; // 🟢 FIX: consistent with uploadDocument

    const documents = await Document.find({ userId }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ documents });
  } catch (error) {
    console.error("Fetch Documents Error:", error);
    return res.status(500).json({ message: "Failed to fetch documents" });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    // 1. Verify Karo Ki Document Isi User Ka Hai Ya Nahi
    const document = await Document.findOne({ _id: documentId, userId });

    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or unauthorized" });
    }

    // 2. MongoDB Se Document Record Delete Karo
    await Document.findByIdAndDelete(documentId);

    // 3. MongoDB Se Linked Chat History Delete Karo
    await Chat.deleteMany({ documentId, userId });

    // 4. ChromaDB Cloud Se Vectors Clean Karo
    try {
      const chromaClient = new CloudClient({
        apiKey: process.env.CHROMA_KEY,
        tenant: process.env.TENANT_KEY,
        database: process.env.DATABASE,
      });

      const collection = await chromaClient.getCollection({
        name: "pdf_documents",
      });

      // ChromaDB se documentId filter ke basis par delete execution
      await collection.delete({
        where: { documentId: documentId.toString() },
      });
    } catch (chromaErr) {
      console.error("ChromaDB Deletion Warning:", chromaErr.message);
      // Main process ko block mat hone do agar ChromaDB response mein issue ho
    }

    // 5. Server Folder (Uploads) Se Physical File Unlink/Delete Karo (Optional)
    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    return res.status(200).json({
      success: true,
      message: "Document, chat history, and vectors deleted successfully",
      deletedDocumentId: documentId,
    });
  } catch (error) {
    console.error("Delete Document Error:", error);
    return res
      .status(500)
      .json({ message: "Failed to delete document", error: error.message });
  }
};
