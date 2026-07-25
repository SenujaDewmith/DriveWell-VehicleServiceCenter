const rateLimit = require("express-rate-limit");

// Disabled under the integration test suite (backend/tests) — every test file
// shares one IP against the same in-process app, so real limits would trip
// within a handful of tests regardless of actual request rate.
const skip = () => process.env.NODE_ENV === "test";

// Throttles brute-force/credential-stuffing attempts against login endpoints.
// Keyed by IP; counts both successful and failed attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many registration attempts. Please try again later." },
});

module.exports = { loginLimiter, registerLimiter };
