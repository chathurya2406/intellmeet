const AuditLog = require("../models/AuditLog");

/**
 * writeAuditLog — persists an audit entry to MongoDB and emits a structured
 * JSON log line to stdout for ingestion by log aggregators (e.g. Loki, CloudWatch).
 *
 * @param {object} params
 * @param {string} params.action   - AuditLog.action enum value
 * @param {object} [params.req]    - Express request object (for IP / user-agent)
 * @param {string} [params.userId] - MongoDB ObjectId string of the acting user
 * @param {string} [params.email]  - Email of the acting user
 * @param {string} [params.meetingId] - Meeting ID if applicable
 * @param {object} [params.meta]   - Additional context (never include passwords)
 * @param {boolean} [params.success=true]
 */
const writeAuditLog = async ({
  action,
  req = null,
  userId = null,
  email = null,
  meetingId = null,
  meta = {},
  success = true,
}) => {
  try {
    const ip = req
      ? (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
          .split(",")[0]
          .trim()
      : null;

    const userAgent = req ? req.headers["user-agent"] || null : null;

    const entry = {
      action,
      userId: userId || null,
      email: email || null,
      meetingId: meetingId || null,
      ip,
      userAgent,
      meta,
      success,
    };

    // Structured log line for stdout / log aggregators
    console.log(
      JSON.stringify({
        level: success ? "info" : "warn",
        type: "AUDIT",
        ...entry,
        timestamp: new Date().toISOString(),
      })
    );

    // Persist to MongoDB (fire-and-forget — don't block the request)
    AuditLog.create(entry).catch((err) =>
      console.error("[auditLogger] Failed to persist audit log:", err.message)
    );
  } catch (err) {
    // Audit logging must never crash the application
    console.error("[auditLogger] Unexpected error:", err.message);
  }
};

module.exports = { writeAuditLog };
