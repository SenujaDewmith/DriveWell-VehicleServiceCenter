const express = require("express");
const router = express.Router();
const {
  listBookings, getBooking, createBooking, cancelBooking, overrideStatus, getAvailableSlots,
} = require("../controllers/bookings.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Reservation management
 */

/**
 * @swagger
 * /api/bookings/available-slots:
 *   get:
 *     summary: Check available time slots for a given date
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date, example: "2025-06-15" }
 *     responses:
 *       200:
 *         description: Availability information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:           { type: boolean }
 *                 reason:              { type: string }
 *                 remaining_capacity:  { type: integer }
 *                 slots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TimeSlot'
 *       400: { description: date param missing }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/available-slots", verifyToken, getAvailableSlots);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: List bookings. Customers see their own; staff see all (with optional filters).
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, example: Booked }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: "2025-06-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: "2025-06-30" }
 *       - in: query
 *         name: customer_id
 *         schema: { type: integer }
 *         description: Filter by customer (staff only)
 *       - in: query
 *         name: package_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, listBookings);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get a single booking with full details
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 booking:
 *                   $ref: '#/components/schemas/Reservation'
 *       401: { description: Not authenticated }
 *       403: { description: Access denied }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.get("/:id", verifyToken, getBooking);

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking (Customer only)
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservationInput'
 *     responses:
 *       201:
 *         description: Booking created and confirmation email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:        { type: string }
 *                 booking_ref:    { type: string, example: "DW-2025-00001" }
 *                 reservation_id: { type: integer }
 *       400: { description: Validation error or no capacity }
 *       403: { description: Not a customer }
 *       500: { description: Server error }
 */
router.post("/", verifyToken, authorizeRoles("Customer"), createBooking);

/**
 * @swagger
 * /api/bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel a booking (Customer cancels their own; Manager can cancel any)
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Booking cancelled and email sent }
 *       400: { description: Cannot cancel in current status }
 *       403: { description: Access denied }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.patch("/:id/cancel", verifyToken, cancelBooking);

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   patch:
 *     summary: Override booking status (Manager only)
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 example: No-show
 *                 enum: [Booked, Started, "In Progress", Completed, "Ready for Pickup", Cancelled, No-show]
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status }
 *       403: { description: Manager only }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.patch("/:id/status", verifyToken, authorizeRoles("Service Center Manager"), overrideStatus);

module.exports = router;
