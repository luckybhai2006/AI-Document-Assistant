import { streamAnswerFromDocs } from "../services/chat.service.js";
import { Chat } from "../models/Chat.js";

export const askQuestionStream = async (req, res) => {
  try {
    const { documentId, multiDocIds, question } = req.body;
    const userId = req.user.userId || req.user._id;

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullAiResponse = "";

    await streamAnswerFromDocs(
      { userId, documentId, multiDocIds, question },
      (chunk) => {
        fullAiResponse += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    );

    if (documentId && fullAiResponse) {
      await saveMessageToHistory(userId, documentId, question, fullAiResponse);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("❌ Stream Error:", error.message);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Streaming failed", error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};

// 1. Fetch Chat History (FIXED: req.params, with guard for bad ids)
export const getChatHistory = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    if (!documentId || documentId === "null" || documentId === "undefined") {
      return res.status(200).json({ messages: [] });
    }

    const chat = await Chat.findOne({ userId, documentId });

    if (!chat) {
      return res.status(200).json({ messages: [] });
    }

    return res.status(200).json({ messages: chat.messages });
  } catch (error) {
    console.error("Fetch Chat Error:", error);
    return res.status(500).json({ message: "Failed to fetch chat history" });
  }
};

// 2. Helper to Save Message
export const saveMessageToHistory = async (
  userId,
  documentId,
  userText,
  aiText
) => {
  try {
    let chat = await Chat.findOne({ userId, documentId });

    if (!chat) {
      chat = new Chat({
        userId,
        documentId,
        title: userText.substring(0, 30) + "...",
        messages: [],
      });
    }

    chat.messages.push({ role: "user", text: userText });
    chat.messages.push({ role: "ai", text: aiText });

    await chat.save();
    return chat;
  } catch (error) {
    console.error("Save Chat History Error:", error);
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required" });
    }

    // Chat document delete/reset karo
    await Chat.findOneAndDelete({ userId, documentId });

    return res.status(200).json({
      success: true,
      message: "Chat history cleared successfully",
    });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    return res.status(500).json({ message: "Failed to clear chat history" });
  }
};
