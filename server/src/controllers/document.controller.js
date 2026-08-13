import { Document } from "../models/Document.js";
import { processDocument } from "../services/document.service.js";
import { Chat } from "../models/Chat.js";
import { CloudClient } from "chromadb";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

// =====================================================
// UPLOAD DOCUMENT
// =====================================================

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const userId = req.user.userId || req.user._id;

    // -------------------------------------------------
    // 1. Upload file to Cloudinary
    // -------------------------------------------------

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "ai-document-assistant",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    // -------------------------------------------------
    // 2. Create MongoDB document
    // -------------------------------------------------

    const newDocument = await Document.create({
      userId,
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: uploadResult.secure_url,
      status: "PENDING",
      progress: 0,
    });

    console.log(`⏳ Document uploaded. Processing started: ${newDocument._id}`);

    // -------------------------------------------------
    // 3. IMPORTANT:
    // Do NOT await processDocument()
    //
    // Processing background mein chalegi.
    // Frontend immediately document ID receive karega.
    // -------------------------------------------------

    processDocument(newDocument._id)
      .then((result) => {
        console.log(`✅ Document processing completed: ${newDocument._id}`);

        console.log(`📦 Total chunks indexed: ${result.totalChunks}`);
      })
      .catch((error) => {
        console.error(
          `❌ Background document processing failed: ${newDocument._id}`,
          error.message
        );
      });

    // -------------------------------------------------
    // 4. Immediately frontend ko response
    // -------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "File uploaded. Document processing started.",
      document: newDocument,
    });
  } catch (error) {
    console.error("❌ Document upload failed:", error.message);

    return res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL USER DOCUMENTS
// =====================================================

export const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const documents = await Document.find({
      userId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      documents,
    });
  } catch (error) {
    console.error("❌ Fetch Documents Error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch documents",
    });
  }
};

// =====================================================
// GET SINGLE DOCUMENT + REAL-TIME PROGRESS
// =====================================================

export const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;

    const userId = req.user.userId || req.user._id;

    const document = await Document.findOne({
      _id: documentId,
      userId,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      document: {
        _id: document._id,
        originalName: document.originalName,
        fileName: document.fileName,
        mimeType: document.mimeType,
        size: document.size,
        status: document.status,
        progress: document.progress,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Get Document Progress Error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch document progress",
    });
  }
};

// =====================================================
// DELETE DOCUMENT
// =====================================================

export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    // -------------------------------------------------
    // 1. Find document belonging to current user
    // -------------------------------------------------

    const document = await Document.findOne({
      _id: documentId,
      userId,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found or unauthorized",
      });
    }

    console.log(`🗑️ Starting deletion for document: ${documentId}`);

    // -------------------------------------------------
    // 2. Delete Chroma vectors FIRST
    // -------------------------------------------------

    try {
      const chromaClient = new CloudClient({
        apiKey: process.env.CHROMA_KEY,
        tenant: process.env.TENANT_KEY,
        database: process.env.DATABASE,
      });

      const collection = await chromaClient.getCollection({
        name: "user-docu",
        embeddingFunction: null,
      });

      console.log(`🔎 Searching Chroma vectors for document: ${documentId}`);

      // First check how many chunks exist
      const existingVectors = await collection.get({
        where: {
          documentId: documentId.toString(),
        },
        include: ["metadatas"],
      });

      const vectorCount = existingVectors?.ids?.length || 0;

      console.log(`📊 Chroma vectors found: ${vectorCount}`);

      // Delete matching vectors
      if (vectorCount > 0) {
        await collection.delete({
          where: {
            documentId: documentId.toString(),
          },
        });

        console.log(`✅ Chroma vectors deleted: ${vectorCount}`);
      } else {
        console.log(`ℹ️ No Chroma vectors found for ${documentId}`);
      }
    } catch (chromaErr) {
      console.error("❌ ChromaDB deletion failed:", chromaErr.message);

      // IMPORTANT:
      // Agar Chroma deletion fail ho gayi,
      // MongoDB document delete nahi karenge.
      return res.status(500).json({
        message: "Failed to delete document vectors from ChromaDB",
        error: chromaErr.message,
      });
    }

    // -------------------------------------------------
    // 3. Delete MongoDB document
    // -------------------------------------------------

    await Document.findByIdAndDelete(documentId);

    console.log(`✅ MongoDB document deleted: ${documentId}`);

    // -------------------------------------------------
    // 4. Delete chat history
    // -------------------------------------------------

    await Chat.deleteMany({
      documentId,
      userId,
    });

    console.log(`✅ Chat history deleted for ${documentId}`);

    // -------------------------------------------------
    // 5. Delete local file if exists
    // -------------------------------------------------

    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);

      console.log(`✅ Local file deleted: ${document.filePath}`);
    }

    // -------------------------------------------------
    // 6. Success response
    // -------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Document, vectors and chat history deleted successfully",
      deletedDocumentId: documentId,
    });
  } catch (error) {
    console.error("❌ Delete Document Error:", error.message);

    return res.status(500).json({
      message: "Failed to delete document",
      error: error.message,
    });
  }
};
