import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import connectDB from "./config/connectDB.js";

dotenv.config();

await connectDB();

const app = express();

app.get("/api/debug/cloudinary", (req, res) => {
  res.json({
    cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
    api_key: !!process.env.CLOUDINARY_API_KEY,
    api_secret: !!process.env.CLOUDINARY_API_SECRET,
  });
});

const allowedOrigins = [
  "http://localhost:5173",
  "https://ai-document-assistant-dabw.vercel.app",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Postman/server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Multer in-memory storage for audio
const upload = multer({
  storage: multer.memoryStorage(),
});

// Audio transcription
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
      console.error("Groq API key is missing");
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

    res.json({
      text: response.data.text,
    });
  } catch (error) {
    console.error(
      "Groq Transcription Error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to transcribe audio",
    });
  }
});

export default app;
