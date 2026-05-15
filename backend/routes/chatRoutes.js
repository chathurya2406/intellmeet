const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  sendMessage,
  getMessages,
} = require("../controllers/chatController");

router.post("/", protect, sendMessage);

router.get("/:meetingId", protect, getMessages);

module.exports = router;