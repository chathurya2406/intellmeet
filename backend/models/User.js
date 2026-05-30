const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      maxlength: [254, "Email cannot exceed 254 characters"],
    },
    // Stored as a bcrypt hash — never the raw password.
    // minlength is intentionally omitted: bcrypt hashes are always 60 chars,
    // and route-layer validation enforces the 8-char minimum before hashing.
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // Never returned in queries unless explicitly selected
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Role must be user or admin",
      },
      default: "user",
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2048, "Avatar URL cannot exceed 2048 characters"],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Hashed refresh token stored server-side for rotation validation.
    // We store a bcrypt hash so a DB breach cannot be used to forge tokens.
    // Set to null on logout or password change.
    refreshTokenHash: {
      type: String,
      default: null,
      select: false, // Never returned in queries unless explicitly selected
    },
    // Incremented on password change or logout-all to invalidate all
    // outstanding refresh tokens for this user (token family rotation).
    tokenVersion: {
      type: Number,
      default: 0,
      min: [0, "Token version cannot be negative"],
    },
    // Email verification flow: user receives a token, hashed token stored in DB.
    // Once verified, emailVerified is set to true and tokens are cleared.
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
      select: false, // Sensitive — never returned in JSON
    },
    emailVerificationTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
    // Password reset flow: user receives reset token link, hashed token stored in DB.
    // Token is one-time use and expires after 1 hour.
    passwordResetToken: {
      type: String,
      default: null,
      select: false, // Sensitive — never returned in JSON
    },
    passwordResetTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    // Strip sensitive fields from all JSON serialization automatically.
    // This is a defence-in-depth measure — routes also use .select("-password").
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// email: unique index is created automatically by unique: true above.

// lastLogin: supports admin queries like "users inactive for 30+ days"
// Sparse: only indexes documents where lastLogin is not null (saves space)
userSchema.index({ lastLogin: -1 }, { sparse: true });

// role: supports admin queries filtering by role
userSchema.index({ role: 1 });

// emailVerificationTokenExpires: supports cleanup of expired verification tokens
// Sparse: only indexes documents where this field exists (saves space)
userSchema.index({ emailVerificationTokenExpires: 1 }, { sparse: true, expireAfterSeconds: 3600 });

// passwordResetTokenExpires: supports cleanup of expired password reset tokens
// Expires after 1 hour (3600 seconds)
userSchema.index({ passwordResetTokenExpires: 1 }, { sparse: true, expireAfterSeconds: 3600 });

module.exports = mongoose.model("User", userSchema);
