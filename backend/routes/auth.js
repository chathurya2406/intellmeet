const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { writeAuditLog } = require("../middleware/auditLogger");

const router = express.Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Access token: short-lived (default 15 minutes)
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";

// Refresh token: long-lived (default 7 days)
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Cookie name for the refresh token
const REFRESH_COOKIE_NAME = "intellmeet_refresh";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * getJwtSecret — returns JWT_SECRET or throws a 500 error.
 * JWT_SECRET is validated at server startup; this is a safety net.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("Server configuration error.");
    err.statusCode = 500;
    throw err;
  }
  return secret;
};

/**
 * getRefreshSecret — returns REFRESH_TOKEN_SECRET.
 * Falls back to JWT_SECRET + "_refresh" if not separately configured.
 * In production, REFRESH_TOKEN_SECRET should always be set explicitly.
 */
const getRefreshSecret = () => {
  return process.env.REFRESH_TOKEN_SECRET || getJwtSecret() + "_refresh";
};

/**
 * issueTokens — creates a signed access token and a signed refresh token
 * for the given user. Stores a bcrypt hash of the refresh token in the DB
 * so we can validate and rotate it server-side.
 *
 * Returns { accessToken, refreshToken } — the raw refresh token is set as
 * an httpOnly cookie by the calling route handler.
 */
const issueTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email, role: user.role, v: user.tokenVersion },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );

  const refreshToken = jwt.sign(
    { id: user._id, v: user.tokenVersion },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  // Store bcrypt hash of refresh token — never the raw token
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await User.findByIdAndUpdate(user._id, { refreshTokenHash });

  return { accessToken, refreshToken };
};

/**
 * setRefreshCookie — sets the refresh token as a Secure, HttpOnly, SameSite=Strict
 * cookie. This prevents JavaScript access (XSS protection) and CSRF attacks.
 */
const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRES_MS,
    path: "/api/auth", // Cookie only sent to auth endpoints
  });
};

/**
 * clearRefreshCookie — removes the refresh token cookie.
 */
const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
  });
};

// ─── POST /api/auth/signup ───────────────────────────────────────────────────

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters." });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      await writeAuditLog({
        action: "USER_SIGNUP",
        req,
        email: email.toLowerCase().trim(),
        success: false,
        meta: { reason: "Email already registered" },
      });
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    const { accessToken, refreshToken } = await issueTokens(user);
    setRefreshCookie(res, refreshToken);

    await writeAuditLog({
      action: "USER_SIGNUP",
      req,
      userId: user._id.toString(),
      email: user.email,
      success: true,
    });

    return res.status(201).json({
      token: accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user) {
      await writeAuditLog({
        action: "USER_LOGIN_FAILED",
        req,
        email: email.toLowerCase().trim(),
        success: false,
        meta: { reason: "User not found" },
      });
      // Generic message — don't reveal whether the email exists
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await writeAuditLog({
        action: "USER_LOGIN_FAILED",
        req,
        userId: user._id.toString(),
        email: user.email,
        success: false,
        meta: { reason: "Wrong password" },
      });
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = await issueTokens(user);
    setRefreshCookie(res, refreshToken);

    await writeAuditLog({
      action: "USER_LOGIN",
      req,
      userId: user._id.toString(),
      email: user.email,
      success: true,
    });

    return res.json({
      token: accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
//
// Validates the httpOnly refresh token cookie, verifies it against the stored
// hash, and issues a new access token + rotated refresh token.
//
// Token rotation: every refresh invalidates the old refresh token and issues
// a new one. If a stolen token is used after rotation, the hash won't match
// and the request is rejected.

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ message: "Refresh token not found." });
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, getRefreshSecret());
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid or expired refresh token." });
    }

    // Load user with refreshTokenHash (normally excluded from queries)
    const user = await User.findById(decoded.id).select("+refreshTokenHash");
    if (!user || !user.refreshTokenHash) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session not found. Please log in again." });
    }

    // Token version check — invalidates tokens issued before password change / logout-all
    if (decoded.v !== user.tokenVersion) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    // Verify the raw token matches the stored hash (rotation validation)
    const isValid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!isValid) {
      // Possible token reuse attack — invalidate all sessions for this user
      await User.findByIdAndUpdate(user._id, {
        refreshTokenHash: null,
        $inc: { tokenVersion: 1 },
      });
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Token reuse detected. All sessions invalidated." });
    }

    // Issue new token pair (rotation)
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
    setRefreshCookie(res, newRefreshToken);

    return res.json({ token: accessToken });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", authMiddleware, async (req, res, next) => {
  try {
    // Invalidate the stored refresh token hash
    await User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null });
    clearRefreshCookie(res);

    await writeAuditLog({
      action: "USER_LOGOUT",
      req,
      userId: req.user.id,
      email: req.user.email,
    });

    return res.json({ message: "Logged out successfully." });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/logout-all ───────────────────────────────────────────────
// Invalidates ALL sessions for this user by incrementing tokenVersion.

router.post("/logout-all", authMiddleware, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      refreshTokenHash: null,
      $inc: { tokenVersion: 1 },
    });
    clearRefreshCookie(res);

    await writeAuditLog({
      action: "USER_LOGOUT_ALL",
      req,
      userId: req.user.id,
      email: req.user.email,
    });

    return res.json({ message: "All sessions invalidated." });
  } catch (error) {
    return next(error);
  }
});

// ─── GET /api/auth/profile ───────────────────────────────────────────────────

router.get("/profile", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

// ─── PUT /api/auth/profile ───────────────────────────────────────────────────

router.put("/profile", authMiddleware, async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ message: "Name must be at least 2 characters." });
      }
      updates.name = name.trim();
    }

    if (avatar !== undefined) {
      if (typeof avatar !== "string") {
        return res.status(400).json({ message: "Avatar must be a string URL." });
      }
      updates.avatar = avatar.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update." });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await writeAuditLog({
      action: "USER_PROFILE_UPDATE",
      req,
      userId: req.user.id,
      email: req.user.email,
      meta: { updatedFields: Object.keys(updates) },
    });

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

// ─── PUT /api/auth/change-password ──────────────────────────────────────────

router.put("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    // Invalidate all existing sessions on password change (security best practice)
    user.refreshTokenHash = null;
    user.tokenVersion += 1;
    await user.save();

    clearRefreshCookie(res);

    await writeAuditLog({
      action: "USER_PROFILE_UPDATE",
      req,
      userId: req.user.id,
      email: req.user.email,
      meta: { updatedFields: ["password"] },
    });

    return res.json({ message: "Password updated successfully. Please log in again." });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Don't reveal whether the email exists (security best practice)
    if (!user) {
      return res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate a secure reset token
    const resetToken = require("crypto").randomBytes(32).toString("hex");
    const resetTokenHash = await bcrypt.hash(resetToken, 10);

    // Store hashed token + expiry (1 hour from now)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // In production, send email with reset link: /reset-password?token=${resetToken}&email=${email}
    // For now, return token in response (only for development/testing)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    console.log(`[auth] Password reset link for ${email}: ${resetLink}`);

    await writeAuditLog({
      action: "USER_PASSWORD_RESET_REQUESTED",
      req,
      email: user.email,
      userId: user._id.toString(),
    });

    return res.json({
      message: "If an account with that email exists, a password reset link has been sent.",
      // Remove in production: only return for testing
      ...(process.env.NODE_ENV === "test" && { resetToken, resetLink }),
    });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "Email, reset token, and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordResetToken");
    if (!user || !user.passwordResetToken) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // Check if token has expired
    if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
      user.passwordResetToken = null;
      user.passwordResetTokenExpires = null;
      await user.save();
      return res.status(400).json({ message: "Reset token has expired. Please request a new one." });
    }

    // Verify the token matches the hash
    const isValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid reset token." });
    }

    // Update password and invalidate all sessions
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    user.refreshTokenHash = null;
    user.tokenVersion += 1;
    await user.save();

    clearRefreshCookie(res);

    await writeAuditLog({
      action: "USER_PASSWORD_RESET",
      req,
      email: user.email,
      userId: user._id.toString(),
    });

    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/send-verification-email ──────────────────────────────────

router.post("/send-verification-email", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.emailVerified) {
      return res.json({ message: "Email is already verified." });
    }

    // Generate verification token
    const verificationToken = require("crypto").randomBytes(32).toString("hex");
    const verificationTokenHash = await bcrypt.hash(verificationToken, 10);

    // Store hashed token + expiry (24 hours from now)
    user.emailVerificationToken = verificationTokenHash;
    user.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // In production, send email with verification link
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

    console.log(`[auth] Email verification link for ${user.email}: ${verificationLink}`);

    await writeAuditLog({
      action: "EMAIL_VERIFICATION_SENT",
      req,
      userId: req.user.id,
      email: user.email,
    });

    return res.json({
      message: "Verification email sent.",
      // Remove in production: only for testing
      ...(process.env.NODE_ENV === "test" && { verificationToken, verificationLink }),
    });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/auth/verify-email ────────────────────────────────────────────

router.post("/verify-email", async (req, res, next) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ message: "Email and verification token are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+emailVerificationToken"
    );

    if (!user || !user.emailVerificationToken) {
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    // Check if token has expired
    if (!user.emailVerificationTokenExpires || user.emailVerificationTokenExpires < new Date()) {
      user.emailVerificationToken = null;
      user.emailVerificationTokenExpires = null;
      await user.save();
      return res.status(400).json({ message: "Verification token has expired. Please request a new one." });
    }

    // Verify the token matches the hash
    const isValid = await bcrypt.compare(token, user.emailVerificationToken);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid verification token." });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save();

    await writeAuditLog({
      action: "EMAIL_VERIFIED",
      userId: user._id.toString(),
      email: user.email,
    });

    return res.json({
      message: "Email verified successfully.",
      user: { id: user._id, name: user.name, email: user.email, emailVerified: user.emailVerified },
    });
  } catch (error) {
    return next(error);
  }
});

// ─── DELETE /api/auth/profile ───────────────────────────────────────────────

router.delete("/profile", authMiddleware, async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required to delete account." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Verify password before deletion
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password." });
    }

    // Delete user account
    await User.findByIdAndDelete(req.user.id);
    clearRefreshCookie(res);

    await writeAuditLog({
      action: "USER_ACCOUNT_DELETED",
      req,
      userId: req.user.id,
      email: req.user.email,
    });

    return res.json({ message: "Account deleted successfully." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
