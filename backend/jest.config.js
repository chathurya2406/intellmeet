module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  collectCoverage: true,
  coverageDirectory: "coverage",
  // Exclude files that require live infrastructure or have no direct test coverage
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "server.js",
    "config/db.js",
    "middleware/socketAuth.js",
    "routes/messages.js",   // HTTP message route — covered via Socket.io integration
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testPathIgnorePatterns: ["/node_modules/"],
  detectOpenHandles: true,
  forceExit: true,
  verbose: false,
};
