const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const { connectRedis } = require("./config/redis");

const app = express();

// Connect Database
connectDB();
connectRedis();

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("IntellMeet Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});