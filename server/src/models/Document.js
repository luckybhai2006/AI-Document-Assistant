import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "INDEXED", "FAILED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

export const Document = mongoose.model("Document", documentSchema);
