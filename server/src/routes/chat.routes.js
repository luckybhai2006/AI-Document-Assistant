import express from "express";
import {
  getChatHistory,
  askQuestionStream,
  clearChatHistory,
} from "../controllers/chat.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// SSE Streaming Route
router.post("/ask", protect, askQuestionStream);
router.get("/history/:documentId", protect, getChatHistory);
router.delete("/history/:documentId", protect, clearChatHistory);

export default router;
