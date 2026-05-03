const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getProfile,
} = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already registered
 *       500:
 *         description: Server error
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user and set JWT as HttpOnly cookie
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful. JWT token is set as an HttpOnly cookie.
 *         headers:
 *           Set-Cookie:
 *             description: HttpOnly session cookie containing the JWT token
 *             schema:
 *               type: string
 *               example: token=eyJhbGci...; HttpOnly; Secure; SameSite=Strict; Path=/
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     role_id:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     description: >
 *       Returns base user info plus a role-specific profile.
 *       - If the user is a **Customer** (role_id: 5), returns data from the `customers` table (full_name, phone, address).
 *       - If the user is **Staff** (Manager, Supervisor, Cashier, Service Staff), returns data from the `staff` table (full_name, phone_no).
 *       Requires a valid JWT stored in an HttpOnly cookie.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user's profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   description: Base account information
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                       example: 3
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     role_id:
 *                       type: integer
 *                       example: 5
 *                     account_status:
 *                       type: string
 *                       example: active
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-01T10:00:00.000Z"
 *                 profile:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/CustomerProfile'
 *                     - $ref: '#/components/schemas/StaffProfile'
 *                   description: Role-specific profile. Shape depends on the user's role.
 *             examples:
 *               customer:
 *                 summary: Customer profile response
 *                 value:
 *                   user:
 *                     user_id: 3
 *                     email: john@example.com
 *                     role_id: 5
 *                     account_status: active
 *                     created_at: "2025-01-01T10:00:00.000Z"
 *                   profile:
 *                     full_name: John Doe
 *                     phone: "+94771234567"
 *                     address: "42 Main Street, Colombo"
 *               staff:
 *                 summary: Staff profile response
 *                 value:
 *                   user:
 *                     user_id: 7
 *                     email: manager@workshop.com
 *                     role_id: 1
 *                     account_status: active
 *                     created_at: "2025-01-01T10:00:00.000Z"
 *                   profile:
 *                     full_name: Sarah Perera
 *                     phone_no: "+94712345678"
 *       401:
 *         description: Not authenticated — missing or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/profile", verifyToken, getProfile);

module.exports = router;

// // Staff-only example route
// router.get(
//   '/staff/dashboard',
//   verifyToken,
//   authorizeRoles('Service Center Manager', 'Supervisor', 'Cashier', 'Service Staff'),
//   (req, res) => res.json({ message: 'Welcome, staff!' })
// );

// // Customer-only example route
// router.get(
//   '/customer/bookings',
//   verifyToken,
//   authorizeRoles('Customer'),
//   (req, res) => res.json({ message: 'Your bookings here' })
// );
