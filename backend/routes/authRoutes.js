const express = require("express");
const rateLimit = require("express-rate-limit");
const protect = require("../middleware/authMiddleware");
const { upload } = require("../config/cloudinary");

const {
  signup,
  login,
  getProfile,
  updateProfile,
  refreshAccessToken,
  logout,
} = require("../controllers/authController");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, try later",
});

router.use(authLimiter);

// Custom middleware to handle Multer/Cloudinary errors gracefully
const handleAvatarUpload = (req, res, next) => {
  const uploadSingle = upload.single("avatar");
  
  uploadSingle(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary Error:", err);
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
        error: err.message || err
      });
    }
    next();
  });
};

router.post("/signup", signup);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, handleAvatarUpload, updateProfile);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);

module.exports = router;