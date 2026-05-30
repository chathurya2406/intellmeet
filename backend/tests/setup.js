const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.NODE_ENV = "test";
  // Provide test JWT secrets so the server doesn't refuse to start
  process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-not-for-production";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-for-unit-tests-only";

  const { connectDB } = require("../config/db");
  await connectDB();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
