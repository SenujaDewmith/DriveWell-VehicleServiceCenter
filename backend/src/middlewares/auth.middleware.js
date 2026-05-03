const jwt = require("jsonwebtoken");
const logger = require("../utils/logger"); // adjust path if needed
require("dotenv").config();

const ROLE_MAP = {
  "Service Center Manager": 1,
  Supervisor: 2,
  Cashier: 3,
  "Service Staff": 4,
  Customer: 5,
};

const verifyToken = (req, res, next) => {
  // Token comes from HttpOnly cookie — not the Authorization header
  const token = req.cookies?.token;

  if (!token) {
    logger.warn(
      `Auth failed — no token in cookies | ${req.method} ${req.originalUrl}`,
    );
    return res
      .status(401)
      .json({ message: "Access denied. Not authenticated." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, email, role_id }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      logger.warn(
        `Auth failed — token expired | user may have been: ${error?.expiredAt}`,
      );
      return res
        .status(401)
        .json({ message: "Session expired. Please log in again." });
    }

    logger.error(`Auth failed — invalid token | ${error.message}`);
    return res.status(403).json({ message: "Invalid token." });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoleId = req.user?.role_id;
    const allowedRoleIds = allowedRoles.map((name) => ROLE_MAP[name]);

    if (!allowedRoleIds.includes(userRoleId)) {
      logger.warn(
        `Authorization failed — role_id ${userRoleId} not in [${allowedRoleIds}] | ${req.method} ${req.originalUrl}`,
      );
      return res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
