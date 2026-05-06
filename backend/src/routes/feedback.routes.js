const express = require("express");
const router = express.Router();
const { listFeedback, submitFeedback, getFeedbackByBooking } = require("../controllers/feedback.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Customer ratings and feedback
 */

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: List feedback. Customers see their own; Manager/Supervisor see all.
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of feedback
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feedback:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Feedback'
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, listFeedback);

/**
 * @swagger
 * /api/feedback/booking/{booking_id}:
 *   get:
 *     summary: Get feedback for a specific booking
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Feedback for the booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feedback:
 *                   $ref: '#/components/schemas/Feedback'
 *       401: { description: Not authenticated }
 *       404: { description: No feedback found }
 *       500: { description: Server error }
 */
router.get("/booking/:booking_id", verifyToken, getFeedbackByBooking);

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit feedback for a completed service (Customer only)
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackInput'
 *     responses:
 *       201: { description: Feedback submitted }
 *       400: { description: Validation error, service not completed, or duplicate feedback }
 *       403: { description: Customer only or access denied }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.post("/", verifyToken, authorizeRoles("Customer"), submitFeedback);

module.exports = router;
