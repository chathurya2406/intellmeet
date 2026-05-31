const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const { connectDB, disconnectDB, getConnectionState } = require("./config/db");
const authRoutes = require("./routes/auth");
const meetingRoutes = require("./routes/meetings");
const messageRoutes = require("./routes/messages");
const { metricsMiddleware, metricsHandler, activeMeetingsGauge, activeUsersGauge } = require("./middleware/metrics");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { authLimiter, apiLimiter, metricsLimiter } = require("./middleware/rateLimiter");
const { mongoSanitizeMiddleware, xssSanitizeMiddleware } = require("./middleware/sanitize");
const socketAuthMiddleware = require("./middleware/socketAuth");
const { writeAuditLog } = require("./middleware/auditLogger");
const Message = require("./models/Message");
const Meeting = require("./models/Meeting");

// ─── Sentry (optional — only initialised when SENTRY_DSN is set) ─────────────
let Sentry = null;
if (process.env.SENTRY_DSN) {
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
}

// ─── Validate critical environment variables at startup ──────────────────────
// Only enforce in non-test environments so Jest can set the variable in beforeAll
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  console.error("[FATAL] JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Connect to MongoDB (skip in test mode — tests call connectDB() themselves via setup.js)
if (process.env.NODE_ENV !== "test") {
  connectDB();
}

// ─── Sentry request handler (must be first middleware) ───────────────────────
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

// ─── Security headers (Helmet) ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for WebRTC
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// ─── Cookie parser (required for httpOnly refresh token cookies) ──────────────
app.use(cookieParser());

// ─── Input sanitization ───────────────────────────────────────────────────────
app.use(mongoSanitizeMiddleware); // NoSQL injection prevention
app.use(xssSanitizeMiddleware);   // XSS prevention

// ─── Prometheus metrics middleware ────────────────────────────────────────────
app.use(metricsMiddleware);

// ─── Health check (no auth required — used by K8s probes) ────────────────────
app.get("/health", (_req, res) => {
  const dbState = getConnectionState();
  const healthy = dbState === "connected";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    db: dbState,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ message: "IntellMeet Backend Running 🚀", version: "1.0.0" });
});

// ─── Metrics endpoint (rate-limited) ─────────────────────────────────────────
app.get("/metrics", metricsLimiter, metricsHandler);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/meetings", apiLimiter, meetingRoutes);
app.use("/api/messages", apiLimiter, messageRoutes);

// ─── Sentry error handler (must be before custom error handler) ───────────────
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

// ─── 404 + global error handler ──────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Ping timeout / interval for connection health
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Authenticate every socket connection with JWT
io.use(socketAuthMiddleware);

// ─── Metrics helpers ──────────────────────────────────────────────────────────
const updateActiveMetrics = async () => {
  try {
    const activeMeetingCount = await Meeting.countDocuments({ status: "active" });
    const sockets = await io.fetchSockets();
    activeMeetingsGauge.set(activeMeetingCount);
    activeUsersGauge.set(sockets.length);
  } catch (error) {
    console.error("[metrics] Failed to update active metrics:", error.message);
  }
};

const endMeetingIfEmpty = async (meetingId) => {
  try {
    const sockets = await io.in(meetingId).allSockets();
    if (sockets.size === 0) {
      const meeting = await Meeting.findOne({ meetingId });
      if (meeting && meeting.status !== "ended") {
        meeting.status = "ended";
        meeting.endTime = new Date();
        meeting.durationSeconds = Math.floor(
          (meeting.endTime - meeting.startTime) / 1000
        );
        await meeting.save();
        console.log(`[meeting] Auto-ended empty meeting: ${meetingId} (${meeting.durationSeconds}s)`);
      }
      await updateActiveMetrics();
    }
  } catch (error) {
    console.error(`[meeting] Error auto-ending meeting ${meetingId}:`, error.message);
    if (Sentry) Sentry.captureException(error);
  }
};

// ─── Socket.io event handlers ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  const { user } = socket; // Populated by socketAuthMiddleware
  console.log(`[socket] Connected: ${user.name} (${user.id})`);

  // ── join-room ──────────────────────────────────────────────────────────────
  socket.on("join-room", async (payload) => {
    try {
      const meetingId = typeof payload === "string" ? payload : payload?.meetingId;

      if (!meetingId || typeof meetingId !== "string" || meetingId.trim().length === 0) {
        socket.emit("error", { message: "Meeting ID is required to join." });
        return;
      }

      const sanitizedMeetingId = meetingId.trim();
      socket.currentMeetingId = sanitizedMeetingId;

      // Upsert meeting record
      let meeting = await Meeting.findOne({ meetingId: sanitizedMeetingId });
      if (!meeting) {
        meeting = await Meeting.create({
          meetingId: sanitizedMeetingId,
          status: "active",
          startTime: new Date(),
          participants: [user.name],
          participantIds: [user.id],
          createdBy: user.id,
          peakParticipantCount: 1,
        });
      } else {
        meeting.status = "active";
        meeting.endTime = null;
        meeting.durationSeconds = null;

        if (!meeting.participants.includes(user.name)) {
          meeting.participants.push(user.name);
        }
        const alreadyTracked = meeting.participantIds.some(
          (id) => id.toString() === user.id
        );
        if (!alreadyTracked) {
          meeting.participantIds.push(user.id);
        }
        if (meeting.participants.length > meeting.peakParticipantCount) {
          meeting.peakParticipantCount = meeting.participants.length;
        }
        await meeting.save();
      }

      socket.join(sanitizedMeetingId);

      // Send full chat history to the joining user
      const chatHistory = await Message.find({ meetingId: sanitizedMeetingId })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      socket.emit("chat-history", chatHistory);

      // Notify other participants
      socket.to(sanitizedMeetingId).emit("user-joined", {
        meetingId: sanitizedMeetingId,
        name: user.name,
        userId: user.id,
      });

      // Send current participant list to the joining user
      socket.emit("meeting-info", {
        meetingId: sanitizedMeetingId,
        participants: meeting.participants,
        startTime: meeting.startTime,
      });

      await writeAuditLog({
        action: "MEETING_JOIN",
        userId: user.id,
        email: user.email,
        meetingId: sanitizedMeetingId,
      });

      await updateActiveMetrics();
    } catch (error) {
      console.error("[socket] join-room error:", error.message);
      if (Sentry) Sentry.captureException(error);
      socket.emit("error", { message: "Unable to join room." });
    }
  });

  // ── chat-message ───────────────────────────────────────────────────────────
  socket.on("chat-message", async (data) => {
    try {
      const meetingId = data?.meetingId || socket.currentMeetingId;
      const text = data?.text;

      if (!meetingId || !text || typeof text !== "string" || text.trim().length === 0) {
        socket.emit("error", { message: "Meeting ID and message text are required." });
        return;
      }

      if (text.trim().length > 2000) {
        socket.emit("error", { message: "Message exceeds 2000 character limit." });
        return;
      }

      const message = await Message.create({
        meetingId,
        sender: user.name,
        userId: user.id,
        text: text.trim(),
      });

      // Broadcast to all participants including sender (for consistency)
      io.to(meetingId).emit("chat-message", message);
    } catch (error) {
      console.error("[socket] chat-message error:", error.message);
      if (Sentry) Sentry.captureException(error);
      socket.emit("error", { message: "Unable to save chat message." });
    }
  });

  // ── WebRTC signaling ───────────────────────────────────────────────────────
  // These events relay WebRTC offer/answer/ICE candidates between peers.
  // The server acts as a signaling relay only — media flows peer-to-peer.

  socket.on("webrtc-offer", ({ targetSocketId, offer }) => {
    socket.to(targetSocketId).emit("webrtc-offer", {
      offer,
      fromSocketId: socket.id,
      fromUser: { id: user.id, name: user.name },
    });
  });

  socket.on("webrtc-answer", ({ targetSocketId, answer }) => {
    socket.to(targetSocketId).emit("webrtc-answer", {
      answer,
      fromSocketId: socket.id,
    });
  });

  socket.on("webrtc-ice-candidate", ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit("webrtc-ice-candidate", {
      candidate,
      fromSocketId: socket.id,
    });
  });

  // ── leave-room ─────────────────────────────────────────────────────────────
  socket.on("leave-room", async ({ meetingId }) => {
    if (meetingId) {
      socket.leave(meetingId);
      socket.to(meetingId).emit("user-left", {
        name: user.name,
        userId: user.id,
      });

      await writeAuditLog({
        action: "MEETING_LEAVE",
        userId: user.id,
        email: user.email,
        meetingId,
      });

      await endMeetingIfEmpty(meetingId);
    }
  });

  // ── disconnecting ──────────────────────────────────────────────────────────
  socket.on("disconnecting", async () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left", {
          name: user.name,
          userId: user.id,
        });
        await endMeetingIfEmpty(room);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[socket] Disconnected: ${user.name} (${user.id})`);
    updateActiveMetrics().catch(() => {});
  });

  socket.on("error", (error) => {
    console.error(`[socket] Error for user ${user.name}:`, error.message);
    if (Sentry) Sentry.captureException(error);
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: `IntellMeet backend started`,
        port: PORT,
        env: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      })
    );
  });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(
      JSON.stringify({
        level: "info",
        message: `Received ${signal} — shutting down gracefully`,
        timestamp: new Date().toISOString(),
      })
    );

    // Stop accepting new connections
    server.close(async () => {
      try {
        // Close all Socket.io connections
        await io.close();
        // Disconnect from MongoDB
        await disconnectDB();
        console.log(
          JSON.stringify({
            level: "info",
            message: "Graceful shutdown complete",
            timestamp: new Date().toISOString(),
          })
        );
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err.message);
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught exceptions — log and exit (let process manager restart)
  process.on("uncaughtException", (err) => {
    console.error(
      JSON.stringify({
        level: "fatal",
        message: "Uncaught exception",
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      })
    );
    if (Sentry) Sentry.captureException(err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(
      JSON.stringify({
        level: "fatal",
        message: "Unhandled promise rejection",
        reason: String(reason),
        timestamp: new Date().toISOString(),
      })
    );
    if (Sentry) Sentry.captureException(reason);
    process.exit(1);
  });
}

module.exports = { app, server, io };
