const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
require("dotenv").config();

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        const err = new Error("Email already registered");
        err.status = 400;
        throw err;
      }

      const role = await tx.role.findFirst({ where: { role_name: "Customer" } });
      if (!role) {
        const err = new Error("Role configuration error");
        err.status = 500;
        throw err;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      return tx.user.create({
        data: {
          email,
          password_hash: hashedPassword,
          role_id: role.role_id,
          customer: { create: { full_name: name.trim() } },
        },
        select: { user_id: true, email: true, role_id: true },
      });
    });

    logger.info(`New customer registered — user_id: ${user.user_id}`);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`Register failed for ${email} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (user.account_status !== "active")
      return res.status(403).json({ message: "Account is inactive. Contact the service center." });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    const expiresIn = rememberMe ? "30d" : "1d";
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge,
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
    const userRecord = await prisma.user.findUnique({
      where: { user_id },
      select: {
        user_id: true,
        email: true,
        role_id: true,
        account_status: true,
        created_at: true,
        customer: role_id === CUSTOMER_ROLE_ID,
        staff: role_id !== CUSTOMER_ROLE_ID,
      },
    });

    if (!userRecord) return res.status(404).json({ message: "User not found" });

    const { customer, staff, ...user } = userRecord;
    const profile = role_id === CUSTOMER_ROLE_ID ? customer : staff;

    res.status(200).json({ user, profile });
  } catch (error) {
    logger.error(`getProfile failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, logout, getProfile };
