const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

// Routes
const meetingRoutes = require("./routes/meetingRoutes");

const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/meetings", meetingRoutes);

// Basic route
app.get("/", (req, res) => {
  res.send("IntellMeet Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = require("http").createServer(app);

// Socket.io
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Socket logic
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // Join room
  socket.on("join-room", (roomId, userId) => {

    socket.join(roomId);

    console.log(`${userId} joined ${roomId}`);

    socket.to(roomId).emit("user-joined", {
      userId,
      socketId: socket.id,
    });
  });

  // Leave room
  socket.on("leave-room", (roomId, userId) => {

    socket.leave(roomId);

    console.log(`${userId} left ${roomId}`);

    socket.to(roomId).emit("user-left", userId);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});