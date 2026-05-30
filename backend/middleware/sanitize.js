const xss = require("xss");

/**
 * sanitizeValue — recursively strips MongoDB operator keys ($ and .) from
 * an object and returns a new sanitized copy. Does NOT mutate the original.
 * OWASP A03: Injection — NoSQL injection prevention.
 */
const sanitizeValue = (value) => {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // Strip keys that start with $ (MongoDB operators)
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === "object") {
    const sanitized = {};
    for (const key of Object.keys(value)) {
      // Remove keys starting with $ or containing . (MongoDB injection vectors)
      if (key.startsWith("$") || key.includes(".")) {
        console.warn(`[SECURITY] Mongo injection key stripped: "${key}"`);
        continue;
      }
      sanitized[key] = sanitizeValue(value[key]);
    }
    return sanitized;
  }

  return value;
};

/**
 * mongoSanitizeMiddleware — sanitizes req.body and req.params by removing
 * MongoDB operator keys. Works with Express 5 (does not touch req.query
 * which is a read-only getter in Express 5).
 */
const mongoSanitizeMiddleware = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.params && typeof req.params === "object") {
    // req.params is writable in Express 5
    try {
      const sanitizedParams = sanitizeValue(req.params);
      Object.assign(req.params, sanitizedParams);
    } catch {
      // Ignore if params is not writable
    }
  }
  next();
};

/**
 * xssSanitizeMiddleware — recursively escapes HTML entities in all string
 * values of req.body to prevent stored/reflected XSS.
 * OWASP A03: Injection / XSS prevention.
 */
const sanitizeStrings = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = xss(obj[key]);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeStrings(obj[key]);
    }
  }
  return obj;
};

const xssSanitizeMiddleware = (req, _res, next) => {
  if (req.body) sanitizeStrings(req.body);
  next();
};

module.exports = { mongoSanitizeMiddleware, xssSanitizeMiddleware };
