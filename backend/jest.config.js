module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup/loadEnv.js"],
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  testTimeout: 20000,
  verbose: true,
};
