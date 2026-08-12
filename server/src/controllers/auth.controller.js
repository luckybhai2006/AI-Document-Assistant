import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";

// REGISTER USER
export const registerUser = async (req, res) => {
  try {
    const { user, email, password } = req.body;

    if (!user || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password (Salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🟢 FIX 1: Create user mein 'user' (name) save karo
    const newUser = await User.create({
      user, // 👈 Model field key (agar aapke Schema me key name 'user' hai)
      email,
      password: hashedPassword,
    });

    // 🟢 FIX 2: Response mein bhi 'user' (name) return karo
    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        user: newUser.user,
        email: newUser.email,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "fallback_secret_for_dev",
      { expiresIn: "1d" }
    );

    // 🟢 FIX: Response mein 'user' (name) field add kar di hai
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        user: user.user, // 👈 DB se User ka Name frontend ko bhej rahe hain
        email: user.email,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
