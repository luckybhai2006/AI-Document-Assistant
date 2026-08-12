import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

// const __dirname = path.resolve();

// // 1. Client/dist folder ko static serve karein
// const distPath = path.join(__dirname, "../client/dist");
// app.use(express.static(distPath));

// // 2. Catch-all route sirf dist/index.html bhejega
// app.get("/{0,}", (req, res) => {
//   res.sendFile(path.join(distPath, "index.html"));
// });
// // 🟢 Isse replace karein:
app.use(
  cors({
    origin: "*", // Sabhi domains ko allow karega
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Multer in-memory storage for audio buffer
const upload = multer({ storage: multer.memoryStorage() });

// 🟢 FIX 1: Direct app.post use kiya gaya hai (/api/transcribe)
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: "audio.webm",
      contentType: req.file.mimetype || "audio/webm",
    });
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");

    // 🟢 FIX 2: GROQ_API_KEY ya GROG_KEY dono support
    const apiKey = process.env.GROQ_API_KEY || process.env.GROG_KEY;

    if (!apiKey) {
      console.error("Groq API key is missing in .env file!");
      return res
        .status(500)
        .json({ error: "Server misconfiguration: Missing API Key" });
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

    res.json({ text: response.data.text });
  } catch (error) {
    console.error(
      "Groq Transcription Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

export default app;
