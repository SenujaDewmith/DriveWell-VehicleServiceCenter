const express = require("express");
const router = express.Router();
const {
  register, login, staffLogin, logout, staffLogout, getProfile,
  forgotPassword, resetPassword,
} = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("../schemas/auth.schema");
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require("../middlewares/rateLimit.middleware");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new customer account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string, example: John Doe }
 *               email:    { type: string, example: john@example.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       201: { description: Registered successfully }
 *       400: { description: Validation error or email taken }
 *       500: { description: Server error }
 */
router.post("/register", registerLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive JWT in HttpOnly cookie
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: john@example.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200:
 *         description: Login successful. JWT set as HttpOnly cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Login successful }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:      { type: integer, example: 1 }
 *                     email:   { type: string,  example: john@example.com }
 *                     role_id: { type: integer, example: 5 }
 *       400: { description: Missing fields }
 *       401: { description: Invalid credentials }
 *       403: { description: Account inactive, or account is a staff/management account }
 *       500: { description: Server error }
 */
router.post("/login", loginLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/staff/login:
 *   post:
 *     summary: Staff/management login and receive JWT in HttpOnly cookie
 *     description: Same credential flow as customer login, but only accounts with a staff role (Service Center Manager, Supervisor, Cashier, Service Staff) are accepted. Customer accounts are rejected.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: manager@drivewell.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200:
 *         description: Login successful. JWT set as HttpOnly cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Login successful }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:      { type: integer, example: 1 }
 *                     email:   { type: string,  example: manager@drivewell.com }
 *                     role_id: { type: integer, example: 1 }
 *       400: { description: Missing fields }
 *       401: { description: Invalid credentials }
 *       403: { description: Account inactive, or account is a customer account }
 *       500: { description: Server error }
 */
router.post("/staff/login", loginLimiter, validate(loginSchema), staffLogin);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout of the customer portal and clear the customer session cookie
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post("/logout", logout);

/**
 * @swagger
 * /api/auth/staff/logout:
 *   post:
 *     summary: Logout of the staff/management portal and clear the staff session cookie
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post("/staff/logout", staffLogout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     user_id:        { type: integer }
 *                     email:          { type: string }
 *                     role_id:        { type: integer }
 *                     account_status: { type: string }
 *                     created_at:     { type: string, format: date-time }
 *                 profile:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/CustomerProfile'
 *                     - $ref: '#/components/schemas/StaffProfile'
 *       401: { description: Not authenticated }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.get("/profile", verifyToken, getProfile);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     description: Always returns 200 with a generic message, whether or not the email is registered, to avoid leaking which emails have accounts. If the account exists, an email with a time-limited reset link is sent.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: john@example.com }
 *     responses:
 *       200: { description: Generic confirmation message }
 *       429: { description: Too many requests }
 *       500: { description: Server error }
 */
router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using a token from the forgot-password email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, new_password]
 *             properties:
 *               token:        { type: string, example: 9f1c... }
 *               new_password: { type: string, example: NewPassw0rd! }
 *     responses:
 *       200: { description: Password reset successfully }
 *       400: { description: Invalid/expired token or validation error }
 *       500: { description: Server error }
 */
router.post("/reset-password", forgotPasswordLimiter, validate(resetPasswordSchema), resetPassword);

module.exports = router;
