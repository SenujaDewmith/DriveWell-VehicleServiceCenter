const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email.service");
const { hashResetToken } = require("../utils/resetToken");
require("dotenv").config();

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

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
    sendWelcomeEmail(user.email, { customerName: name.trim() });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`Register failed for ${email} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// Role IDs allowed to authenticate through each portal. Enforced server-side
// so a role mismatch can't be bypassed by calling the API directly — the
// frontend that's calling it is never trusted to self-report who it is.
const CUSTOMER_ROLE_IDS = [5];
const STAFF_ROLE_IDS = [1, 2, 3, 4];

// Separate cookie names per portal so a customer login in one tab doesn't
// clobber a staff session in another tab (and vice versa) on the same host.
const COOKIE_NAMES = { customer: "customer_token", staff: "staff_token" };

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  ...(maxAge !== undefined && { maxAge }),
});

const authenticate = async (req, res, { allowedRoleIds, wrongPortalMessage, cookieName }) => {
  const { email, password, rememberMe = false } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (user.account_status === "pending")
      return res.status(403).json({ message: "Set your password using the link sent to your email before logging in." });
    if (user.account_status !== "active")
      return res.status(403).json({ message: "Account is inactive. Contact the service center." });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    if (!allowedRoleIds.includes(user.role_id)) {
      logger.warn(`Login blocked — user_id: ${user.user_id} used wrong portal (role_id ${user.role_id})`);
      return res.status(403).json({ message: wrongPortalMessage });
    }

    const expiresIn = rememberMe ? "30d" : "1d";
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.cookie(cookieName, token, cookieOptions(maxAge));

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

const login = (req, res) =>
  authenticate(req, res, {
    allowedRoleIds: CUSTOMER_ROLE_IDS,
    wrongPortalMessage: "This portal is for customers only. Staff should use the staff login.",
    cookieName: COOKIE_NAMES.customer,
  });

const staffLogin = (req, res) =>
  authenticate(req, res, {
    allowedRoleIds: STAFF_ROLE_IDS,
    wrongPortalMessage: "This portal is for service center staff only.",
    cookieName: COOKIE_NAMES.staff,
  });

const logout = (req, res) => {
  res.clearCookie(COOKIE_NAMES.customer, cookieOptions());
  res.status(200).json({ message: "Logged out successfully" });
};

const staffLogout = (req, res) => {
  res.clearCookie(COOKIE_NAMES.staff, cookieOptions());
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

// Same response whether or not the account exists, so this endpoint can't be
// used to probe which emails are registered.
const FORGOT_PASSWORD_RESPONSE = {
  message: "If an account exists for that email, a password reset link has been sent.",
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { customer: true, staff: true },
    });

    if (!user) return res.status(200).json(FORGOT_PASSWORD_RESPONSE);

    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        reset_token_hash: hashResetToken(rawToken),
        reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    const customerName = user.customer?.full_name ?? user.staff?.full_name ?? "there";
    sendPasswordResetEmail(user.email, { customerName, resetUrl });

    logger.info(`Password reset requested — user_id: ${user.user_id}`);
    res.status(200).json(FORGOT_PASSWORD_RESPONSE);
  } catch (error) {
    logger.error(`forgotPassword failed for ${email} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { token, new_password } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: { reset_token_hash: hashResetToken(token), reset_token_expires_at: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired." });

    const newHash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password_hash: newHash,
        // Cleared here so the same link can't be replayed after it's been used once.
        reset_token_hash: null,
        reset_token_expires_at: null,
        // This same endpoint doubles as the manager-invite first-time setup link —
        // a pending account becomes active the moment its owner sets a password.
        ...(user.account_status === "pending" && { account_status: "active" }),
      },
    });

    logger.info(`Password reset completed — user_id: ${user.user_id}`);
    res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    logger.error(`resetPassword failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register, login, staffLogin, logout, staffLogout, getProfile,
  forgotPassword, resetPassword,
};
