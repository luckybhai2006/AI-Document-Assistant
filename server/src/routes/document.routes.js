import express from "express";

import {
  uploadDocument,
  getUserDocuments,
  getDocumentById,
  deleteDocument,
} from "../controllers/document.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// =====================================================
// Upload Document
// POST /api/documents/upload
// =====================================================

router.post("/upload", protect, upload.single("file"), uploadDocument);

// =====================================================
// Get All User Documents
// GET /api/documents
// =====================================================

router.get("/", protect, getUserDocuments);

// =====================================================
// Get Single Document + Progress
// GET /api/documents/:documentId
// =====================================================

router.get("/:documentId", protect, getDocumentById);

// =====================================================
// Delete Document
// DELETE /api/documents/:documentId
// =====================================================

router.delete("/:documentId", protect, deleteDocument);

export default router;
