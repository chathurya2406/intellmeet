const mongoose = require("mongoose");

let mongoMemoryServer;

/**
 * connectDB — establishes a MongoDB connection.
 *
 * In production/development: connects to MONGO_URI from environment.
 * In test/dev without MONGO_URI: spins up an in-memory MongoDB instance.
 *
 * Production connection options are tuned for:
 * - Connection pool sizing (maxPoolSize: 10)
 * - Timeout handling (serverSelectionTimeoutMS, socketTimeoutMS)
 * - Heartbeat monitoring (heartbeatFrequencyMS)
 */
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (uri) {
      const options = {
        // Connection pool: max 10 simultaneous connections
        maxPoolSize: 10,
        minPoolSize: 2,
        // How long to wait for a server to be selected (ms)
        serverSelectionTimeoutMS: 5000,
        // How long a send/receive on a socket can take (ms)
        socketTimeoutMS: 45000,
        // How often to check server health (ms)
        heartbeatFrequencyMS: 10000,
        // Reconnect automatically
        autoIndex: process.env.NODE_ENV !== "production", // Disable auto-index in prod for performance
      };

      await mongoose.connect(uri, options);
      console.log("MongoDB Connected");
      return;
    }

    // Fallback: in-memory MongoDB for development without a real DB
    // Never used in production (MONGO_URI is required there)
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongoMemoryServer = await MongoMemoryServer.create();
    const memUri = mongoMemoryServer.getUri();

    await mongoose.connect(memUri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("In-memory MongoDB started and connected (development mode)");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message || error);
    process.exit(1);
  }
};

/**
 * disconnectDB — gracefully closes the MongoDB connection.
 * Used in tests and graceful shutdown handlers.
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
    }
  } catch (error) {
    console.error("Error disconnecting MongoDB:", error.message || error);
  }
};

/**
 * getConnectionState — returns a human-readable connection state.
 * Useful for health check endpoints.
 */
const getConnectionState = () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] || "unknown";
};

// Log connection events for observability
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

module.exports = { connectDB, disconnectDB, getConnectionState };
