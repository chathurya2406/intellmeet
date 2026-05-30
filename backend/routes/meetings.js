const express = require("express");
const Meeting = require("../models/Meeting");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { writeAuditLog } = require("../middleware/auditLogger");

const router = express.Router();

// All meeting routes require authentication
router.use(authMiddleware);

// ─── POST /api/meetings/:meetingId/start ─────────────────────────────────────

router.post("/:meetingId/start", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const participantName = req.user.name || req.user.email;
    const userId = req.user.id;

    let meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      meeting = await Meeting.create({
        meetingId,
        status: "active",
        startTime: new Date(),
        participants: [participantName],
        participantIds: [userId],
        createdBy: userId,
        peakParticipantCount: 1,
      });
    } else if (meeting.status === "ended") {
      // Restart an ended meeting
      meeting.status = "active";
      meeting.startTime = new Date();
      meeting.endTime = null;
      meeting.durationSeconds = null;
      meeting.participants = [participantName];
      meeting.participantIds = [userId];
      meeting.peakParticipantCount = 1;
      await meeting.save();
    } else {
      // Meeting already active — add participant if not already present
      if (!meeting.participants.includes(participantName)) {
        meeting.participants.push(participantName);
      }
      const userIdStr = userId.toString();
      const alreadyTracked = meeting.participantIds.some(
        (id) => id.toString() === userIdStr
      );
      if (!alreadyTracked) {
        meeting.participantIds.push(userId);
      }
      if (meeting.participants.length > meeting.peakParticipantCount) {
        meeting.peakParticipantCount = meeting.participants.length;
      }
      await meeting.save();
    }

    await writeAuditLog({
      action: "MEETING_START",
      req,
      userId,
      meetingId,
    });

    return res.json({ meeting });
  } catch (error) {
    return next(error);
  }
});

// ─── GET /api/meetings/:meetingId ────────────────────────────────────────────

router.get("/:meetingId", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId })
      .populate("createdBy", "name email")
      .lean();

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const messages = await Message.find({ meetingId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return res.json({ meeting, messages });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/meetings/:meetingId/end ───────────────────────────────────────

router.post("/:meetingId/end", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    if (meeting.status === "ended") {
      return res.json({ meeting, message: "Meeting already ended." });
    }

    meeting.status = "ended";
    meeting.endTime = new Date();
    meeting.durationSeconds = Math.floor(
      (meeting.endTime - meeting.startTime) / 1000
    );
    await meeting.save();

    await writeAuditLog({
      action: "MEETING_END",
      req,
      userId: req.user.id,
      meetingId,
      meta: { durationSeconds: meeting.durationSeconds },
    });

    return res.json({ meeting, message: "Meeting ended successfully." });
  } catch (error) {
    return next(error);
  }
});

// ─── GET /api/meetings/:meetingId/analytics ──────────────────────────────────

router.get("/:meetingId/analytics", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId }).lean();

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const messageCount = await Message.countDocuments({ meetingId });

    const analytics = {
      meetingId: meeting.meetingId,
      status: meeting.status,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      durationSeconds: meeting.durationSeconds,
      durationFormatted: meeting.durationSeconds
        ? formatDuration(meeting.durationSeconds)
        : null,
      participantCount: meeting.participants.length,
      peakParticipantCount: meeting.peakParticipantCount,
      participants: meeting.participants,
      messageCount,
      hasAiSummary: !!meeting.aiSummary,
      actionItemCount: meeting.actionItems?.length || 0,
      completedActionItems:
        meeting.actionItems?.filter((a) => a.completed).length || 0,
      hasRecording: !!meeting.recordingMetadata?.url,
    };

    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
});

// ─── GET /api/meetings (user's meeting history) ──────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter = { createdBy: req.user.id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-actionItems -aiSummary -recordingMetadata")
        .lean(),
      Meeting.countDocuments(filter),
    ]);

    return res.json({
      meetings,
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

// ─── POST /api/meetings/:meetingId/ai-summary ────────────────────────────────

router.post("/:meetingId/ai-summary", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { summary, actionItems } = req.body;

    if (!summary || typeof summary !== "string" || summary.trim().length === 0) {
      return res.status(400).json({ message: "Summary text is required." });
    }

    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    meeting.aiSummary = summary.trim();

    if (Array.isArray(actionItems)) {
      const validItems = actionItems
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          text: item.text.trim(),
          assignedTo: item.assignedTo || null,
          completed: false,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        }));
      meeting.actionItems = validItems;
    }

    await meeting.save();

    await writeAuditLog({
      action: "AI_SUMMARY_SAVED",
      req,
      userId: req.user.id,
      meetingId,
      meta: { actionItemCount: meeting.actionItems.length },
    });

    return res.json({
      message: "AI summary saved.",
      aiSummary: meeting.aiSummary,
      actionItems: meeting.actionItems,
    });
  } catch (error) {
    return next(error);
  }
});

// ─── PATCH /api/meetings/:meetingId/action-items/:itemId ─────────────────────

router.patch("/:meetingId/action-items/:itemId", async (req, res, next) => {
  try {
    const { meetingId, itemId } = req.params;
    const { completed, assignedTo, dueDate } = req.body;

    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const item = meeting.actionItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Action item not found." });
    }

    if (completed !== undefined) item.completed = Boolean(completed);
    if (assignedTo !== undefined) item.assignedTo = assignedTo;
    if (dueDate !== undefined) item.dueDate = dueDate ? new Date(dueDate) : null;

    await meeting.save();

    return res.json({ actionItem: item });
  } catch (error) {
    return next(error);
  }
});

// ─── DELETE /api/meetings/:meetingId/action-items/:itemId ────────────────────

router.delete("/:meetingId/action-items/:itemId", async (req, res, next) => {
  try {
    const { meetingId, itemId } = req.params;

    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const item = meeting.actionItems.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Action item not found." });
    }

    item.deleteOne(); // Mongoose subdocument deletion
    await meeting.save();

    await writeAuditLog({
      action: "ACTION_ITEM_DELETED",
      req,
      userId: req.user.id,
      meetingId,
      meta: { itemId, itemText: item.text },
    });

    return res.json({ message: "Action item deleted successfully." });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/meetings/:meetingId/recording ─────────────────────────────────

router.post("/:meetingId/recording", async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { url, durationSeconds, sizeBytes, format } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "Recording URL is required." });
    }

    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    meeting.recordingMetadata = {
      url: url.trim(),
      durationSeconds: durationSeconds || null,
      sizeBytes: sizeBytes || null,
      format: format || null,
      recordedAt: new Date(),
    };

    await meeting.save();

    return res.json({
      message: "Recording metadata saved.",
      recordingMetadata: meeting.recordingMetadata,
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null, `${s}s`]
    .filter(Boolean)
    .join(" ");
};

module.exports = router;
