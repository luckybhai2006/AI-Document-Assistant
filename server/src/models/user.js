import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      // required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
export const User = mongoose.model("User", userSchema);
