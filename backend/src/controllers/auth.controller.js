const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
require("dotenv").config();

// REGISTER
const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    logger.warn(`Register attempt with missing fields`);
    return res
      .status(400)
      .json({ message: "name, email, and password are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.warn(`Register attempt with invalid email format: ${email}`);
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (password.length < 6) {
    logger.warn(`Register attempt with short password for email: ${email}`);
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  if (name.trim().length < 2) {
    return res
      .status(400)
      .json({ message: "Name must be at least 2 characters" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    logger.info(`Register attempt started for email: ${email}`);

    // Check if user already exists
    const existing = await client.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      logger.warn(`Register failed — email already exists: ${email}`);
      return res.status(400).json({ message: "Email already registered" });
    }

    const roleResult = await client.query(
      "SELECT role_id FROM roles WHERE role_name = $1",
      ["Customer"],
    );

    if (roleResult.rows.length === 0) {
      await client.query("ROLLBACK");
      logger.error("Register failed — Customer role not found");
      return res
        .status(500)
        .json({ message: "Role configuration error. Contact admin." });
    }

    const role_id = roleResult.rows[0].role_id;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO users (email, password_hash, role_id)
       VALUES ($1, $2, $3)
       RETURNING user_id, email, role_id`,
      [email, hashedPassword, role_id],
    );

    const customer = await client.query(
      `INSERT INTO customers (user_id, full_name)
       VALUES ($1, $2)
       RETURNING user_id, full_name`,
      [result.rows[0].user_id, name.trim()],
    );

    await client.query("COMMIT");
    logger.info(
      `New customer registered successfully — user_id: ${result.rows[0].user_id}`,
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
      customer: customer.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(
      `Register transaction failed for email: ${email} — ${error.message}`,
    );
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;

  // WARN: missing fields — user input issue
  if (!email || !password) {
    logger.warn(`Login attempt with missing fields`);
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    // WARN: user not found — expected, not a system fault
    if (result.rows.length === 0) {
      logger.warn(`Login failed — email not found: ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      logger.warn(`Login failed — incorrect password for email: ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // relaxed for dev
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    // INFO: successful login — positive event worth tracking
    logger.info(`Login successful — user_id: ${user.user_id}, email: ${email}`);

    res.status(200).json({
      message: "Login successful",

      user: {
        id: user.user_id,
        email: user.email,
        role_id: user.role_id,
      },
    });
  } catch (error) {
    // ERROR: database or system-level failure
    logger.error(
      `Login failed — server error for email: ${email} — ${error.message}`,
    );
    res.status(500).json({ message: "Server error" });
  }
};

// GET PROFILE (protected route example)
const getProfile = async (req, res) => {
  const { user_id, role_id } = req.user; // decoded from JWT

  // Role IDs based on your seeded data
  const CUSTOMER_ROLE_ID = 5;

  try {
    // Fetch base user info
    const userResult = await pool.query(
      `SELECT user_id, email, role_id, account_status, created_at
       FROM users WHERE user_id = $1`,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // Fetch profile from the correct table
    let profile = null;

    if (role_id === CUSTOMER_ROLE_ID) {
      const customerResult = await pool.query(
        `SELECT full_name, phone, address FROM customers WHERE user_id = $1`,
        [user_id],
      );
      profile = customerResult.rows[0] || null;
    } else {
      // All staff roles (Manager, Supervisor, Cashier, Service Staff)
      const staffResult = await pool.query(
        `SELECT full_name, phone_no FROM staff WHERE user_id = $1`,
        [user_id],
      );
      profile = staffResult.rows[0] || null;
    }

    res.status(200).json({ user, profile });
  } catch (error) {
    logger.error(
      `getProfile failed for user_id: ${user_id} — ${error.message}`,
    );
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, getProfile };
