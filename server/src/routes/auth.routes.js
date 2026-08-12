import express from "express";
import { registerUser, loginUser } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected Route Test
router.get("/me", protect, (req, res) => {
  res.status(200).json({
    message: "Access granted to protected route!",
    user: req.user,
  });
});
export default router;
