import express from "express";
import {
  uploadDocument,
  getUserDocuments,
  deleteDocument,
} from "../controllers/document.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Protected Route: User must be authenticated to upload
router.post("/upload", protect, upload.single("file"), uploadDocument);
router.get("/", protect, getUserDocuments);
router.delete("/:documentId", protect, deleteDocument);

export default router;
