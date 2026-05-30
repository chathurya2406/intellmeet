const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const actionItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Action item text is required"],
      trim: true,
      maxlength: [500, "Action item text cannot exceed 500 characters"],
    },
    assignedTo: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, "Assignee name cannot exceed 100 characters"],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

const recordingMetadataSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Recording URL is required"],
      trim: true,
      maxlength: [2048, "Recording URL cannot exceed 2048 characters"],
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: [0, "Recording duration cannot be negative"],
    },
    sizeBytes: {
      type: Number,
      default: null,
      min: [0, "Recording size cannot be negative"],
    },
    format: {
      type: String,
      default: null,
      trim: true,
      maxlength: [20, "Format string cannot exceed 20 characters"],
    },
    recordedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const meetingSchema = new mongoose.Schema(
  {
    // meetingId is the human-readable room identifier (e.g. "abc123").
    // unique: true automatically creates a unique index.
    meetingId: {
      type: String,
      required: [true, "Meeting ID is required"],
      unique: true,
      trim: true,
      minlength: [1, "Meeting ID cannot be empty"],
      maxlength: [100, "Meeting ID cannot exceed 100 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["active", "ended"],
        message: "Status must be 'active' or 'ended'",
      },
      default: "active",
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
      default: () => new Date(),
    },
    endTime: {
      type: Date,
      default: null,
      validate: {
        validator(v) {
          // endTime must be after startTime when set
          return !v || !this.startTime || v >= this.startTime;
        },
        message: "End time must be after start time",
      },
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: [0, "Duration cannot be negative"],
    },
    // Display names of participants (for real-time UI).
    // Capped at 500 to prevent unbounded array growth.
    participants: {
      type: [String],
      default: [],
      validate: {
        validator(v) {
          return v.length <= 500;
        },
        message: "A meeting cannot have more than 500 participants",
      },
    },
    // MongoDB ObjectId references to authenticated participants.
    // Capped at 500 to match participants array.
    participantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: {
        validator(v) {
          return v.length <= 500;
        },
        message: "A meeting cannot have more than 500 participant IDs",
      },
    },
    // User who created / first started the meeting.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // AI-generated meeting summary (populated after meeting ends).
    aiSummary: {
      type: String,
      default: null,
      trim: true,
      maxlength: [10000, "AI summary cannot exceed 10000 characters"],
    },
    // AI-extracted action items. Capped at 100 items.
    actionItems: {
      type: [actionItemSchema],
      default: [],
      validate: {
        validator(v) {
          return v.length <= 100;
        },
        message: "A meeting cannot have more than 100 action items",
      },
    },
    // Recording metadata (populated when a recording is saved externally).
    recordingMetadata: {
      type: recordingMetadataSchema,
      default: null,
    },
    // Denormalized peak participant count for analytics queries.
    // Avoids expensive array length aggregations.
    peakParticipantCount: {
      type: Number,
      default: 0,
      min: [0, "Peak participant count cannot be negative"],
    },
  },
  {
    timestamps: true,
    // Include virtuals when converting to JSON (e.g. durationFormatted in API responses)
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        // Remove the Mongoose virtual 'id' duplicate of '_id'
        delete ret.id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// meetingId: unique index created automatically by unique: true above.

// Compound index for analytics: filter by status, sort by creation time.
// Covers: Meeting.countDocuments({ status }), Meeting.find({ status }).sort({ createdAt })
meetingSchema.index({ status: 1, createdAt: -1 });

// Compound index for user meeting history WITH optional status filter.
// Covers: Meeting.find({ createdBy }).sort({ createdAt: -1 })
//         Meeting.find({ createdBy, status }).sort({ createdAt: -1 })
// This replaces the old { createdBy: 1, createdAt: -1 } index — MongoDB can
// use a prefix of a compound index, so { createdBy } queries still use this.
meetingSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

// Sparse index on endTime for queries like "meetings that ended today".
// Sparse: only indexes documents where endTime is not null.
meetingSchema.index({ endTime: -1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// durationFormatted: human-readable duration string (e.g. "1h 23m 45s")
// Included in JSON output via toJSON: { virtuals: true }
meetingSchema.virtual("durationFormatted").get(function () {
  if (this.durationSeconds == null) return null;
  const h = Math.floor(this.durationSeconds / 3600);
  const m = Math.floor((this.durationSeconds % 3600) / 60);
  const s = this.durationSeconds % 60;
  return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null, `${s}s`]
    .filter(Boolean)
    .join(" ");
});

module.exports = mongoose.model("Meeting", meetingSchema);
