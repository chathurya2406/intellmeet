const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// =========================
// ROOM USERS STORAGE
// =========================
const roomUsers = {};

// =========================
// MIDDLEWARE
// =========================
app.use(cors());
app.use(express.json());

// =========================
// ROUTES
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// =========================
// SOCKET.IO
// =========================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // =========================
  // JOIN ROOM
  // =========================
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);

    socket.username = username;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }

    if (!roomUsers[roomId].includes(username)) {
      roomUsers[roomId].push(username);
    }

    const Meeting = require("./models/Meeting");

    Meeting.findOneAndUpdate(
      { roomId },
      {
        $setOnInsert: {
          createdBy: username,
        },
        $addToSet: {
          participants: username,
        },
      },
      {
        upsert: true,
        new: true,
      }
    )
      .then((meeting) => {
        console.log(
          "Meeting Updated:",
          meeting.roomId
        );
      })
      .catch(console.error);

    io.to(roomId).emit(
      "participant-list",
      roomUsers[roomId]
    );

    socket.to(roomId).emit(
      "user-joined",
      {
        socketId: socket.id,
        username,
      }
    );

    console.log(
      `${username} joined ${roomId}`
    );
  });

  // =========================
  // OFFER
  // =========================
  socket.on(
    "offer",
    ({ roomId, offer }) => {
      console.log(
        "Offer received from:",
        socket.id
      );

      socket.to(roomId).emit(
        "offer",
        {
          offer,
        }
      );
    }
  );

  // =========================
  // ANSWER
  // =========================
  socket.on(
    "answer",
    ({ roomId, answer }) => {
      console.log(
        "Answer received from:",
        socket.id
      );

      socket.to(roomId).emit(
        "answer",
        {
          answer,
        }
      );
    }
  );

  // =========================
  // ICE CANDIDATE
  // =========================
  socket.on(
    "ice-candidate",
    ({ roomId, candidate }) => {
      console.log(
        "ICE candidate received"
      );

      socket.to(roomId).emit(
        "ice-candidate",
        {
          candidate,
        }
      );
    }
  );

  // =========================
  // CHAT (SAVED TO MONGODB)
  // =========================
  socket.on(
    "send-message",
    async ({ roomId, message }) => {
      try {
        const Chat =
          require("./models/Chat");

        await Chat.create({
          roomId,
          username: message.username,
          message: message.text,
        });

        console.log(
          "Message saved to DB"
        );
      } catch (err) {
        console.log(err);
      }

      io.to(roomId).emit(
        "receive-message",
        {
          message,
        }
      );
    }
  );

  // =========================
  // SCREEN SHARE
  // =========================
  socket.on(
    "screen-share-started",
    ({ roomId, username }) => {
      socket.to(roomId).emit(
        "screen-share-started",
        username
      );
    }
  );

  // =========================
  // LEAVE ROOM
  // =========================
  socket.on(
    "leave-room",
    ({ roomId, username }) => {
      socket.leave(roomId);

      if (roomUsers[roomId]) {
        roomUsers[roomId] =
          roomUsers[roomId].filter(
            (user) =>
              user !== username
          );

        io.to(roomId).emit(
          "participant-list",
          roomUsers[roomId]
        );
      }

      socket.to(roomId).emit(
        "user-left",
        username
      );
    }
  );

  // =========================
  // DISCONNECT
  // =========================
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const username = socket.username;

    if (
      roomId &&
      roomUsers[roomId]
    ) {
      roomUsers[roomId] =
        roomUsers[roomId].filter(
          (user) =>
            user !== username
        );

      io.to(roomId).emit(
        "participant-list",
        roomUsers[roomId]
      );
    }

    console.log(
      "User disconnected:",
      socket.id
    );
  });
});

// =========================
// MONGODB
// =========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    console.log("MongoDB Connected")
  )
  .catch((err) => console.log(err));

// =========================
// START SERVER
// =========================
const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});