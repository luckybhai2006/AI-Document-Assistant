import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: GEMINI_KEY is missing in .env file!");
}

// 🔴 FIX: apiVersion "v1" set kar diya hai
const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: "v1" });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DirectGeminiEmbeddings {
  async embedDocuments(texts) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embeddings = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      let attempts = 0;
      let success = false;

      while (attempts < 3 && !success) {
        try {
          attempts++;
          const res = await model.embedContent(text);
          if (res && res.embedding && res.embedding.values) {
            embeddings.push(res.embedding.values);
            success = true;
          }
        } catch (err) {
          console.warn(
            `⚠️ Chunk ${i + 1} embedding attempt ${attempts} failed: ${
              err.message
            }`
          );
          if (attempts >= 3) {
            embeddings.push(new Array(768).fill(0));
          } else {
            await delay(1000);
          }
        }
      }
      await delay(200);
    }

    return embeddings;
  }

  async embedQuery(text) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    let attempts = 0;

    while (attempts < 3) {
      try {
        attempts++;
        const res = await model.embedContent(text);
        return res.embedding.values;
      } catch (err) {
        console.warn(
          `⚠️ Query embedding attempt ${attempts} failed: ${err.message}`
        );
        if (attempts >= 3) {
          return new Array(768).fill(0);
        }
        await delay(1000);
      }
    }
  }
}

export const getGeminiEmbeddings = () => {
  return new DirectGeminiEmbeddings();
};
