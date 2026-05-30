module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  collectCoverage: true,
  coverageDirectory: "coverage",
  // Exclude files that require live infrastructure (WebSocket, DB connection bootstrap)
  // from coverage thresholds — they are tested via integration but not line-by-line.
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "server.js",
    "config/db.js",
    "middleware/socketAuth.js",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  testPathIgnorePatterns: ["/node_modules/"],
  // Detect open handles to help diagnose async leaks in CI
  detectOpenHandles: true,
  // Force exit after all tests complete (prevents hanging on open DB connections)
  forceExit: true,
  // Verbose output for CI readability
  verbose: false,
};
