import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://ai-document-assistant-dabw.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ CORS blocked:", origin);

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    optionsSuccessStatus: 204,
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json());

// =====================================================
// DEBUG
// =====================================================

app.get("/api/debug", (req, res) => {
  res.json({
    success: true,
    message: "Backend API is working",
  });
});

app.get("/api/debug/cloudinary", (req, res) => {
  res.json({
    cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
    api_key: !!process.env.CLOUDINARY_API_KEY,
    api_secret: !!process.env.CLOUDINARY_API_SECRET,
  });
});

// =====================================================
// ROUTES
// =====================================================

app.use("/api/auth", authRoutes);

app.use("/api/documents", documentRoutes);

app.use("/api/chat", chatRoutes);

// =====================================================
// MULTER - AUDIO
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),
});

// =====================================================
// AUDIO TRANSCRIPTION
// =====================================================

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No audio file provided",
      });
    }

    const formData = new FormData();

    formData.append("file", req.file.buffer, {
      filename: "audio.webm",
      contentType: req.file.mimetype || "audio/webm",
    });

    formData.append("model", "whisper-large-v3-turbo");

    formData.append("response_format", "json");

    const apiKey = process.env.GROQ_API_KEY || process.env.GROG_KEY;

    if (!apiKey) {
      console.error("❌ Groq API key is missing");

      return res.status(500).json({
        error: "Server misconfiguration: Missing API Key",
      });
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return res.json({
      text: response.data.text,
    });
  } catch (error) {
    console.error(
      "❌ Groq Transcription Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Failed to transcribe audio",
    });
  }
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);

  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
  console.error("❌ Express Error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS blocked this origin",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

export default app;
