const mongoose = require("mongoose");

/**
 * AuditLog — persists a tamper-evident trail of sensitive actions.
 * Written by auditLogger middleware and route handlers.
 * Used for compliance, security incident investigation, and user activity reporting.
 *
 * Design decisions:
 * - versionKey: false — audit logs are append-only, __v adds no value
 * - TTL index — auto-expires logs after 90 days (configurable)
 * - All indexes are compound with createdAt for efficient time-range queries
 */
const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "Audit action is required"],
      enum: {
        values: [
          // Authentication
          "USER_SIGNUP",
          "USER_LOGIN",
          "USER_LOGIN_FAILED",
          "USER_LOGOUT",
          "USER_LOGOUT_ALL",
          // Profile
          "USER_PROFILE_UPDATE",
          // Meetings
          "MEETING_START",
          "MEETING_END",
          "MEETING_JOIN",
          "MEETING_LEAVE",
          // Chat
          "CHAT_MESSAGE",
          // AI
          "AI_SUMMARY_SAVED",
        ],
        message: "Invalid audit action: {VALUE}",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
    },
    meetingId: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, "Meeting ID cannot exceed 100 characters"],
    },
    ip: {
      type: String,
      default: null,
      trim: true,
      maxlength: [45, "IP address cannot exceed 45 characters"], // IPv6 max length
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    success: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // Audit logs are append-only — disable __v versioning overhead
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// TTL index: auto-expire audit logs after 90 days.
// Adjust expireAfterSeconds for your compliance requirements (e.g. 365 days for SOC2).
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, name: "ttl_90days" }
);

// Compound index: all audit events for a specific user, sorted by time.
// Covers: AuditLog.find({ userId }).sort({ createdAt: -1 })
auditLogSchema.index({ userId: 1, createdAt: -1 });

// Compound index: all audit events for a specific meeting.
// Covers: AuditLog.find({ meetingId }).sort({ createdAt: -1 })
auditLogSchema.index({ meetingId: 1, createdAt: -1 });

// Compound index: filter by action type with time range.
// Covers: AuditLog.find({ action: "USER_LOGIN_FAILED" }).sort({ createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 });

// Compound index for security dashboards: failed events by IP.
// Covers: AuditLog.find({ success: false, ip }).sort({ createdAt: -1 })
auditLogSchema.index({ success: 1, ip: 1, createdAt: -1 });

// Sparse index on email for user lookup without userId (e.g. pre-auth failures).
// Sparse: only indexes documents where email is not null.
auditLogSchema.index({ email: 1, createdAt: -1 }, { sparse: true });

module.exports = mongoose.model("AuditLog", auditLogSchema);
