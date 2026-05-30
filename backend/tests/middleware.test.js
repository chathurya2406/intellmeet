/**
 * middleware.test.js
 *
 * Unit tests for middleware that are not covered by the HTTP integration tests:
 * - auth.requireRole
 * - errorHandler (Mongoose errors, JWT errors, generic errors)
 * - notFound handler
 * - sanitize middleware (edge cases)
 */

const { errorHandler, notFound } = require("../middleware/errorHandler");
const { requireRole } = require("../middleware/auth");
const { mongoSanitizeMiddleware, xssSanitizeMiddleware } = require("../middleware/sanitize");

require("./setup");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * mockRes — creates a minimal Express response mock.
 */
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * mockReq — creates a minimal Express request mock.
 */
const mockReq = (overrides = {}) => ({
  path: "/test",
  method: "GET",
  ip: "127.0.0.1",
  ...overrides,
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe("requireRole middleware", () => {
  it("should call next() when user has the required role", () => {
    const req = { user: { id: "1", role: "admin" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should call next() when user has one of multiple allowed roles", () => {
    const req = { user: { id: "1", role: "user" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("admin", "user")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should return 403 when user does not have the required role", () => {
    const req = { user: { id: "1", role: "user" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/forbidden/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when req.user is not set", () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── errorHandler ────────────────────────────────────────────────────────────

describe("errorHandler middleware", () => {
  const next = jest.fn();

  it("should handle Mongoose ValidationError with 400", () => {
    const err = {
      name: "ValidationError",
      errors: {
        email: { message: "Invalid email" },
        name: { message: "Name required" },
      },
    };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Invalid email") })
    );
  });

  it("should handle Mongoose CastError (invalid ObjectId) with 400", () => {
    const err = { name: "CastError", kind: "ObjectId", message: "Cast to ObjectId failed" };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid ID format." })
    );
  });

  it("should handle MongoDB duplicate key error (code 11000) with 409", () => {
    const err = { code: 11000, keyValue: { email: "test@example.com" } };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("email") })
    );
  });

  it("should handle JWT JsonWebTokenError with 401", () => {
    const err = { name: "JsonWebTokenError", message: "invalid signature" };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid or expired token." })
    );
  });

  it("should handle JWT TokenExpiredError with 401", () => {
    const err = { name: "TokenExpiredError", message: "jwt expired" };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should handle generic errors with 500", () => {
    const err = new Error("Something went wrong");
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Something went wrong" })
    );
  });

  it("should use err.statusCode when provided", () => {
    const err = new Error("Not found");
    err.statusCode = 404;
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should handle duplicate key error with no keyValue gracefully", () => {
    const err = { code: 11000 };
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ─── notFound handler ─────────────────────────────────────────────────────────

describe("notFound handler", () => {
  it("should return 404 with route information", () => {
    const req = mockReq({ method: "GET", path: "/api/unknown" });
    const res = mockRes();

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("/api/unknown") })
    );
  });
});

// ─── sanitize middleware ──────────────────────────────────────────────────────

describe("mongoSanitizeMiddleware", () => {
  it("should strip MongoDB operator keys from req.body", () => {
    const req = {
      body: { "$where": "malicious", name: "valid" },
      params: {},
    };
    const res = mockRes();
    const next = jest.fn();

    mongoSanitizeMiddleware(req, res, next);

    expect(req.body).not.toHaveProperty("$where");
    expect(req.body).toHaveProperty("name", "valid");
    expect(next).toHaveBeenCalled();
  });

  it("should strip keys containing dots from req.body", () => {
    const req = {
      body: { "user.password": "hack", email: "test@example.com" },
      params: {},
    };
    const res = mockRes();
    const next = jest.fn();

    mongoSanitizeMiddleware(req, res, next);

    expect(req.body).not.toHaveProperty("user.password");
    expect(req.body).toHaveProperty("email", "test@example.com");
    expect(next).toHaveBeenCalled();
  });

  it("should handle null and undefined values without throwing", () => {
    const req = { body: { name: null, value: undefined }, params: {} };
    const res = mockRes();
    const next = jest.fn();

    expect(() => mongoSanitizeMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("should handle nested objects", () => {
    const req = {
      body: { user: { "$gt": "", name: "valid" } },
      params: {},
    };
    const res = mockRes();
    const next = jest.fn();

    mongoSanitizeMiddleware(req, res, next);

    expect(req.body.user).not.toHaveProperty("$gt");
    expect(req.body.user).toHaveProperty("name", "valid");
  });

  it("should handle arrays in req.body", () => {
    const req = {
      body: { items: ["a", "b", "c"] },
      params: {},
    };
    const res = mockRes();
    const next = jest.fn();

    mongoSanitizeMiddleware(req, res, next);

    expect(req.body.items).toEqual(["a", "b", "c"]);
    expect(next).toHaveBeenCalled();
  });

  it("should call next() when req.body is empty", () => {
    const req = { body: {}, params: {} };
    const res = mockRes();
    const next = jest.fn();

    mongoSanitizeMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("xssSanitizeMiddleware", () => {
  it("should escape HTML entities in string values", () => {
    const req = {
      body: { name: "<script>alert('xss')</script>", email: "test@example.com" },
    };
    const res = mockRes();
    const next = jest.fn();

    xssSanitizeMiddleware(req, res, next);

    expect(req.body.name).not.toContain("<script>");
    expect(req.body.email).toBe("test@example.com");
    expect(next).toHaveBeenCalled();
  });

  it("should handle nested objects", () => {
    const req = {
      body: { user: { bio: "<img src=x onerror=alert(1)>" } },
    };
    const res = mockRes();
    const next = jest.fn();

    xssSanitizeMiddleware(req, res, next);

    expect(req.body.user.bio).not.toContain("onerror");
    expect(next).toHaveBeenCalled();
  });

  it("should call next() when req.body is absent", () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    xssSanitizeMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
