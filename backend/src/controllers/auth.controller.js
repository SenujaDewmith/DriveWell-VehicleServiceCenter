const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
require("dotenv").config();

const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "name, email, and password are required" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ message: "Invalid email format" });

  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  if (name.trim().length < 2)
    return res.status(400).json({ message: "Name must be at least 2 characters" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Email already registered" });
    }

    const roleResult = await client.query("SELECT role_id FROM roles WHERE role_name = 'Customer'");
    if (roleResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Role configuration error" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role_id) VALUES ($1, $2, $3) RETURNING user_id, email, role_id`,
      [email, hashedPassword, roleResult.rows[0].role_id]
    );

    await client.query(
      `INSERT INTO customers (user_id, full_name) VALUES ($1, $2)`,
      [userResult.rows[0].user_id, name.trim()]
    );

    await client.query("COMMIT");
    logger.info(`New customer registered — user_id: ${userResult.rows[0].user_id}`);

    res.status(201).json({ message: "User registered successfully", user: userResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`Register failed for ${email} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = result.rows[0];

    if (user.account_status !== "active")
      return res.status(403).json({ message: "Account is inactive. Contact the service center." });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    logger.info(`Login successful — user_id: ${user.user_id}`);
    res.status(200).json({
      message: "Login successful",
      user: { id: user.user_id, email: user.email, role_id: user.role_id },
    });
  } catch (error) {
    logger.error(`Login error for ${email} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

const getProfile = async (req, res) => {
  const { user_id, role_id } = req.user;
  const CUSTOMER_ROLE_ID = 5;

  try {
    const userResult = await pool.query(
      `SELECT user_id, email, role_id, account_status, created_at FROM users WHERE user_id = $1`,
      [user_id]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = userResult.rows[0];
    let profile = null;

    if (role_id === CUSTOMER_ROLE_ID) {
      const r = await pool.query(`SELECT full_name, phone, address FROM customers WHERE user_id = $1`, [user_id]);
      profile = r.rows[0] || null;
    } else {
      const r = await pool.query(`SELECT full_name, phone_no FROM staff WHERE user_id = $1`, [user_id]);
      profile = r.rows[0] || null;
    }

    res.status(200).json({ user, profile });
  } catch (error) {
    logger.error(`getProfile failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, logout, getProfile };
