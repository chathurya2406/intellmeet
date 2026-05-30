const express = require("express");
const Message = require("../models/Message");
const Meeting = require("../models/Meeting");
const authMiddleware = require("../middleware/auth");
const { writeAuditLog } = require("../middleware/auditLogger");

const router = express.Router();

// All message routes require authentication
router.use(authMiddleware);

// ─── POST /api/messages/:meetingId ───────────────────────────────────────────
//
// Create a chat message in a meeting directly via HTTP.
// (In addition to the Socket.io chat-message event)
//
// This endpoint allows messages to be sent outside of the real-time WebSocket
// connection, useful for integrations, retries, or alternative communication paths.

router.post("/:meetingId", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { text } = req.body;

    // Input validation
    if (!meetingId || typeof meetingId !== "string" || meetingId.trim().length === 0) {
      return res.status(400).json({ message: "Meeting ID is required." });
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ message: "Message text is required." });
    }

    if (text.trim().length > 2000) {
      return res.status(400).json({ message: "Message exceeds 2000 character limit." });
    }

    // Verify meeting exists
    const meeting = await Meeting.findOne({ meetingId: meetingId.trim() });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    // Create the message
    const message = await Message.create({
      meetingId: meetingId.trim(),
      sender: req.user.name,
      userId: req.user.id,
      text: text.trim(),
    });

    await writeAuditLog({
      action: "CHAT_MESSAGE",
      req,
      userId: req.user.id,
      meetingId: meetingId.trim(),
      meta: { messageLength: text.trim().length },
    });

    return res.status(201).json({
      message: "Message sent successfully.",
      data: message,
    });
  } catch (error) {
    return next(error);
  }
});

// ─── GET /api/messages/:meetingId ────────────────────────────────────────────
//
// Retrieve chat messages for a meeting with pagination.

router.get("/:meetingId", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // Verify meeting exists
    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    // Retrieve messages with pagination
    const [messages, total] = await Promise.all([
      Message.find({ meetingId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ meetingId }),
    ]);

    return res.json({
      meetingId,
      messages: messages.reverse(), // Return in chronological order (oldest first)
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ─── DELETE /api/messages/:messageId ─────────────────────────────────────────
//
// Delete a chat message (only the sender can delete their own message).

router.delete("/:messageId", async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Verify the user is the sender
    if (message.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own messages." });
    }

    const meetingId = message.meetingId;
    await Message.findByIdAndDelete(messageId);

    await writeAuditLog({
      action: "CHAT_MESSAGE",
      req,
      userId: req.user.id,
      meetingId,
      meta: { messageId },
    });

    return res.json({ message: "Message deleted successfully." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
