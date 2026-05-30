const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // meetingId is the human-readable room identifier matching Meeting.meetingId
    meetingId: {
      type: String,
      required: [true, "Meeting ID is required"],
      trim: true,
      maxlength: [100, "Meeting ID cannot exceed 100 characters"],
    },
    // Display name of the sender. Defaults to "Guest" for unauthenticated users.
    // Note: required and default are mutually exclusive in practice — the default
    // satisfies the required check, so we use default only.
    sender: {
      type: String,
      trim: true,
      default: "Guest",
      maxlength: [100, "Sender name cannot exceed 100 characters"],
    },
    // Optional reference to the authenticated user who sent the message.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
      minlength: [1, "Message cannot be empty"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query pattern: fetch all messages for a meeting sorted by time.
// Covers: Message.find({ meetingId }).sort({ createdAt: 1 })
//         Message.countDocuments({ meetingId })
messageSchema.index({ meetingId: 1, createdAt: 1 });

// Index for user message history (e.g. "all messages sent by user X")
// Sparse: only indexes documents where userId is not null
messageSchema.index({ userId: 1, createdAt: -1 }, { sparse: true });

module.exports = mongoose.model("Message", messageSchema);
