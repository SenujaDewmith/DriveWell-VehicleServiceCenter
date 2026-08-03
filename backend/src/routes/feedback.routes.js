const express = require("express");
const router = express.Router();
const {
  listFeedback,
  submitFeedback,
  getFeedbackByBooking,
  listPublicTestimonials,
  featureFeedback,
  unfeatureFeedback,
} = require("../controllers/feedback.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Customer ratings and feedback
 */

/**
 * @swagger
 * /api/feedback/public:
 *   get:
 *     summary: List a curated set of highly-rated testimonials for public/marketing display (no auth)
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: List of testimonials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 testimonials:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feedback_id:  { type: integer, example: 1 }
 *                       rating:       { type: integer, example: 5 }
 *                       comment:      { type: string, example: "Great service!" }
 *                       display_name: { type: string, example: "Sarah J." }
 *       500: { description: Server error }
 */
router.get("/public", listPublicTestimonials);

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

/**
 * @swagger
 * /api/feedback/{id}/feature:
 *   patch:
 *     summary: Feature feedback as a testimonial on the public landing page (Manager only, max 4 at a time)
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Feedback featured }
 *       400: { description: Already at the max number of featured testimonials }
 *       403: { description: Manager only }
 *       404: { description: Feedback not found }
 *       500: { description: Server error }
 */
router.patch("/:id/feature", managerOnly, featureFeedback);

/**
 * @swagger
 * /api/feedback/{id}/unfeature:
 *   patch:
 *     summary: Remove feedback from the landing page's testimonials section (Manager only)
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Feedback unfeatured }
 *       403: { description: Manager only }
 *       404: { description: Feedback not found }
 *       500: { description: Server error }
 */
router.patch("/:id/unfeature", managerOnly, unfeatureFeedback);

module.exports = router;
