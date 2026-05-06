const express = require("express");
const router = express.Router();
const { updateProfile, changePassword } = require("../controllers/profile.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Authenticated user profile management
 */

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update the authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/CustomerProfile'
 *               - $ref: '#/components/schemas/StaffProfile'
 *           examples:
 *             customer:
 *               summary: Customer update
 *               value: { full_name: John Doe, phone: "+94771234567", address: "42 Main St, Colombo" }
 *             staff:
 *               summary: Staff update
 *               value: { full_name: Kasun Silva, phone_no: "+94711234567" }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 profile:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/CustomerProfile'
 *                     - $ref: '#/components/schemas/StaffProfile'
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.put("/", verifyToken, updateProfile);

/**
 * @swagger
 * /api/profile/change-password:
 *   put:
 *     summary: Change the authenticated user's password
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string, example: oldpass123 }
 *               new_password:     { type: string, example: newpass456 }
 *     responses:
 *       200: { description: Password changed successfully }
 *       400: { description: Validation error }
 *       401: { description: Current password incorrect }
 *       500: { description: Server error }
 */
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
