/**
 * errorHandler — global Express error handling middleware.
 * Must be registered AFTER all routes and other middleware.
 *
 * Handles:
 * - Mongoose ValidationError → 400
 * - Mongoose CastError (invalid ObjectId) → 400
 * - Mongoose duplicate key (code 11000) → 409
 * - JWT errors → 401
 * - Generic errors → 500
 */
const errorHandler = (err, req, res, _next) => {
  // Structured error log for log aggregators
  console.error(
    JSON.stringify({
      level: "error",
      type: "UNHANDLED_ERROR",
      message: err.message,
      name: err.name,
      code: err.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    })
  );

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(". ") });
  }

  // Mongoose invalid ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format." });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `${field} already exists.` });
  }

  // JWT errors (should normally be caught in middleware, but just in case)
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    message,
    // Only expose stack trace in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

/**
 * notFound — catch-all for unmatched routes.
 */
const notFound = (req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
};

module.exports = { errorHandler, notFound };
