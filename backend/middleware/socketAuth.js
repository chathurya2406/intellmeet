const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * socketAuthMiddleware — Socket.io middleware that verifies the JWT token
 * passed in socket.handshake.auth.token before allowing the connection.
 *
 * The frontend must pass the token when creating the socket:
 *   io(BACKEND_URL, { auth: { token: localStorage.getItem("token") } })
 *
 * On success, attaches req.user-equivalent to socket.user.
 * On failure, calls next() with an Error to reject the connection.
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("[SECURITY] JWT_SECRET is not set — refusing all socket connections");
      return next(new Error("Server configuration error."));
    }

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication token required."));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return next(new Error("User not found."));
    }

    // Attach user to socket for use in event handlers
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new Error("Token expired."));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new Error("Invalid token."));
    }
    console.error("[socketAuth] Unexpected error:", error);
    return next(new Error("Authentication failed."));
  }
};

module.exports = socketAuthMiddleware;
