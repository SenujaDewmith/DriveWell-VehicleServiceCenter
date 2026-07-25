const rateLimit = require("express-rate-limit");

// Throttles brute-force/credential-stuffing attempts against login endpoints.
// Keyed by IP; counts both successful and failed attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Please try again later." },
});

module.exports = { loginLimiter, registerLimiter };
