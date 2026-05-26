const express = require("express");
const router = express.Router();

const {
  getChats,
} = require(
  "../controllers/chatController"
);

router.get("/:roomId", getChats);

module.exports = router;