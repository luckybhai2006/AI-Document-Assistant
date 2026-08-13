import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("❌ GEMINI_KEY / GEMINI_API_KEY is missing");
}

const genAI = new GoogleGenerativeAI(apiKey, {
  apiVersion: "v1",
});

const MODEL_NAME = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DirectGeminiEmbeddings {
  // 🔥 CHANGE: onProgress callback add kiya
  async embedDocuments(texts, onProgress) {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
    });

    const embeddings = [];

    for (let i = 0; i < texts.length; i++) {
      let attempts = 0;

      while (attempts < 3) {
        try {
          attempts++;

          const res = await model.embedContent({
            content: {
              parts: [{ text: texts[i] }],
            },
            outputDimensionality: EMBEDDING_DIMENSION,
          });

          const values = res?.embedding?.values;

          if (!values) {
            throw new Error("Gemini returned no embedding values");
          }

          if (values.length !== EMBEDDING_DIMENSION) {
            throw new Error(
              `Wrong embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${values.length}`
            );
          }

          embeddings.push(values);

          console.log(
            `✅ Chunk ${i + 1}/${texts.length} embedding: ${
              values.length
            } dimensions`
          );

          // 🔥 NEW: progress callback
          if (onProgress) {
            await onProgress(i + 1, texts.length);
          }

          break;
        } catch (error) {
          console.warn(
            `⚠️ Chunk ${i + 1} embedding attempt ${attempts} failed:`,
            error.message
          );

          if (attempts >= 3) {
            throw new Error(
              `Failed to create embedding for chunk ${i + 1}: ${error.message}`
            );
          }

          await delay(1000);
        }
      }

      await delay(200);
    }

    return embeddings;
  }

  // ❌ Isme kuch change nahi kiya
  async embedQuery(text) {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
    });

    let attempts = 0;

    while (attempts < 3) {
      try {
        attempts++;

        const res = await model.embedContent({
          content: {
            parts: [{ text }],
          },
          outputDimensionality: EMBEDDING_DIMENSION,
        });

        const values = res?.embedding?.values;

        if (!values) {
          throw new Error("Gemini returned no query embedding");
        }

        if (values.length !== EMBEDDING_DIMENSION) {
          throw new Error(
            `Wrong query embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${values.length}`
          );
        }

        console.log(
          `✅ Query embedding generated: ${values.length} dimensions`
        );

        return values;
      } catch (error) {
        console.warn(
          `⚠️ Query embedding attempt ${attempts} failed:`,
          error.message
        );

        if (attempts >= 3) {
          throw new Error(
            `Failed to generate query embedding: ${error.message}`
          );
        }

        await delay(1000);
      }
    }
  }
}

export const getGeminiEmbeddings = () => {
  return new DirectGeminiEmbeddings();
};
