import { streamAnswerFromDocs } from "../services/chat.service.js";
import { Chat } from "../models/Chat.js";

// =========================
// Ask Question - Streaming
// =========================
export const askQuestionStream = async (req, res) => {
  try {
    const { documentId, multiDocIds, question } = req.body;
    const userId = req.user.userId || req.user._id;

    if (!question) {
      return res.status(400).json({
        message: "Question is required",
      });
    }

    // =========================
    // SSE Headers
    // =========================
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullAiResponse = "";

    // =========================
    // Stream AI Answer
    // =========================
    const result = await streamAnswerFromDocs(
      {
        userId,
        documentId,
        multiDocIds,
        question,
      },
      (chunk) => {
        fullAiResponse += chunk;

        res.write(
          `data: ${JSON.stringify({
            type: "text",
            text: chunk,
          })}\n\n`
        );
      }
    );

    // =========================
    // Send Sources
    // =========================
    if (result.sources && result.sources.length > 0) {
      res.write(
        `data: ${JSON.stringify({
          type: "sources",
          sources: result.sources,
        })}\n\n`
      );
    }

    // =========================
    // Save Chat History
    // =========================
    if (documentId && fullAiResponse) {
      await saveMessageToHistory(
        userId,
        documentId,
        question,
        fullAiResponse,
        result.sources
      );
    }

    // =========================
    // Stream Finished
    // =========================
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("❌ Stream Error:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Streaming failed",
        error: error.message,
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: error.message,
      })}\n\n`
    );

    res.end();
  }
};

// =========================
// Get Chat History
// =========================
export const getChatHistory = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    if (!documentId || documentId === "null" || documentId === "undefined") {
      return res.status(200).json({
        messages: [],
      });
    }

    const chat = await Chat.findOne({
      userId,
      documentId,
    });

    if (!chat) {
      return res.status(200).json({
        messages: [],
      });
    }

    return res.status(200).json({
      messages: chat.messages,
    });
  } catch (error) {
    console.error("Fetch Chat Error:", error);

    return res.status(500).json({
      message: "Failed to fetch chat history",
    });
  }
};

// =========================
// Save Message To History
// =========================
export const saveMessageToHistory = async (
  userId,
  documentId,
  userText,
  aiText,
  sources = []
) => {
  try {
    let chat = await Chat.findOne({
      userId,
      documentId,
    });

    if (!chat) {
      chat = new Chat({
        userId,
        documentId,
        title: userText.substring(0, 30) + "...",
        messages: [],
      });
    }

    chat.messages.push({
      role: "user",
      text: userText,
    });

    chat.messages.push({
      role: "ai",
      text: aiText,
      sources: sources,
    });

    await chat.save();

    return chat;
  } catch (error) {
    console.error("Save Chat History Error:", error);
  }
};

// =========================
// Clear Chat History
// =========================
export const clearChatHistory = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId || req.user._id;

    if (!documentId) {
      return res.status(400).json({
        message: "Document ID is required",
      });
    }

    await Chat.findOneAndDelete({
      userId,
      documentId,
    });

    return res.status(200).json({
      success: true,
      message: "Chat history cleared successfully",
    });
  } catch (error) {
    console.error("Clear Chat Error:", error);

    return res.status(500).json({
      message: "Failed to clear chat history",
    });
  }
};
