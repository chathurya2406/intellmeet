const rateLimit = require("express-rate-limit");

// In test mode, use a very permissive limiter so tests don't hit rate limits
const isTest = process.env.NODE_ENV === "test";

/**
 * Auth rate limiter — applied to /api/auth/login and /api/auth/signup.
 * Strict: 10 attempts per 15 minutes per IP.
 * Prevents brute-force credential attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 10,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
  skipSuccessfulRequests: false,
});

/**
 * General API rate limiter — applied to all /api/* routes.
 * Permissive: 100 requests per 15 minutes per IP.
 * Prevents API abuse and DoS.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Metrics limiter — applied to /metrics endpoint.
 * Prevents scraping abuse from external actors.
 */
const metricsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many metrics requests." },
});

module.exports = { authLimiter, apiLimiter, metricsLimiter };
