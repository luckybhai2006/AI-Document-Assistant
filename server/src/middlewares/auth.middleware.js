import jwt from "jsonwebtoken";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized, no token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret_for_dev"
    );

    req.user = decoded;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Not authorized, token failed or expired" });
  }
};
