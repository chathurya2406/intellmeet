const express = require("express");
const protect = require("../middleware/authMiddleware");

const {
  signup,
  login,
  getProfile,
  refreshAccessToken,
  logout,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);

module.exports = router;