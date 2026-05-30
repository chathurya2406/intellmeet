const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * authMiddleware — verifies the Bearer JWT token in the Authorization header.
 * Attaches { id, name, email, role } to req.user on success.
 * Returns 401 on any failure — never reveals the specific reason to the client.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[SECURITY] JWT_SECRET is not configured.");
      return res.status(500).json({ message: "Server configuration error." });
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing." });
    }

    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).lean();
    if (!user) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    // Don't leak token error details to the client
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

/**
 * requireRole — role-based authorization middleware factory.
 * Usage: router.delete("/admin/...", authMiddleware, requireRole("admin"), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized." });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient permissions." });
  }
  return next();
};

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
