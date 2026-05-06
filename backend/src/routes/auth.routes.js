const express = require("express");
const router = express.Router();
const { register, login, logout, getProfile } = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

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
router.post("/register", register);

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
 *       403: { description: Account inactive }
 *       500: { description: Server error }
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and clear the session cookie
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post("/logout", logout);

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

module.exports = router;
