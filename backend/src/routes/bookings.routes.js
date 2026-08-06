const express = require("express");
const router = express.Router();
const {
  listBookings, getBooking, createBooking, rescheduleBooking, cancelBooking, overrideStatus, releaseVehicle,
  getAvailableSlots, getMonthAvailability,
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
 *     summary: Get package-aware appointment windows for a given date. Business hours are chunked into back-to-back windows sized to the package's duration; each window's capacity comes from the package's max_capacity.
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date, example: "2025-06-15" }
 *       - in: query
 *         name: package_id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: exclude_reservation_id
 *         schema: { type: integer }
 *         description: Excludes this reservation from vehicle/capacity conflict checks — set by the reschedule flow so a booking's own current slot doesn't show as a self-conflict
 *     responses:
 *       200:
 *         description: Appointment windows for the date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available: { type: boolean, description: "True if at least one window has remaining capacity" }
 *                 reason:    { type: string }
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start_time:   { type: string, example: "08:00" }
 *                       end_time:     { type: string, example: "09:30" }
 *                       capacity:     { type: integer, description: "Package's max_capacity — concurrent bookings allowed" }
 *                       booked_count: { type: integer }
 *                       remaining:    { type: integer }
 *       400: { description: date or package_id param missing }
 *       401: { description: Not authenticated }
 *       404: { description: Service package not found }
 *       500: { description: Server error }
 */
router.get("/available-slots", verifyToken, getAvailableSlots);

/**
 * @swagger
 * /api/bookings/calendar:
 *   get:
 *     summary: Day-level availability status for every day in a given month, for a specific package (for the booking calendar)
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: integer, example: 5, description: "1-12" }
 *       - in: query
 *         name: package_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Per-day availability
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 days:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:               { type: string, format: date }
 *                       status:             { type: string, enum: [available, limited, full, closed] }
 *                       remaining_capacity: { type: integer, description: "Number of still-bookable appointment windows that day" }
 *                       total_windows:      { type: integer, description: "Total appointment windows generated for this package that day" }
 *       400: { description: year, month, or package_id param missing }
 *       401: { description: Not authenticated }
 *       404: { description: Service package not found }
 *       500: { description: Server error }
 */
router.get("/calendar", verifyToken, getMonthAvailability);

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
 *       - in: query
 *         name: vehicle_id
 *         schema: { type: integer }
 *         description: Filter by vehicle. For a customer, only the vehicle's current owner may use this — returns every booking ever made against the vehicle (not just their own), redacting the previous owner's identity and invoice details.
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
 *     summary: Create a new booking, or "Book Again" from a closed booking (Customer only)
 *     description: >
 *       Books directly with vehicle_id/package_id, or "Book Again" from the customer's own
 *       Cancelled or Collected booking by additionally passing source_reservation_id — that
 *       only gates eligibility (must be their own booking, must be Cancelled/Collected), it
 *       never overrides vehicle_id/package_id, which are ordinary request-body values (usually
 *       pre-filled from the source booking by the wizard, but editable). To change the date/time
 *       of a still-live Booked appointment, use PATCH /api/bookings/{id}/reschedule instead —
 *       that updates the existing reservation in place rather than creating a new one.
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
 *       400: { description: Validation error, no capacity, or source booking not Cancelled/Collected }
 *       403: { description: Not a customer, or source booking belongs to someone else }
 *       404: { description: source_reservation_id not found }
 *       500: { description: Server error }
 */
router.post("/", verifyToken, authorizeRoles("Customer"), createBooking);

/**
 * @swagger
 * /api/bookings/{id}/reschedule:
 *   patch:
 *     summary: Move a Booked appointment to a new vehicle/package/date/time (Customer reschedules their own; Manager can reschedule any)
 *     description: >
 *       Updates the existing reservation in place (same booking_ref) rather than creating a
 *       new one — only valid while the booking is still "Booked". A Customer is subject to the
 *       same 24-hour cutoff as cancelBooking; a Manager is exempt, for the "customer called in
 *       to reschedule" case.
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
 *             required: [vehicle_id, package_id, service_date, start_time]
 *             properties:
 *               vehicle_id:   { type: integer, example: 2 }
 *               package_id:   { type: integer, example: 1 }
 *               service_date: { type: string, format: date, example: "2025-06-20" }
 *               start_time:   { type: string, example: "09:00" }
 *     responses:
 *       200: { description: Booking rescheduled and email sent }
 *       400: { description: Validation error, no capacity, or booking not in "Booked" status }
 *       403: { description: Access denied }
 *       404: { description: Booking not found }
 *       409: { description: Vehicle or slot conflict at the new time }
 *       500: { description: Server error }
 */
router.patch("/:id/reschedule", verifyToken, authorizeRoles("Customer", "Service Center Manager"), rescheduleBooking);

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
router.patch("/:id/cancel", verifyToken, authorizeRoles("Customer", "Service Center Manager"), cancelBooking);

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   patch:
 *     summary: Override booking status (Manager, or Supervisor for No-show only)
 *     description: >
 *       Managers may set any status. Supervisors may only set "No-show" — they get a 403 for
 *       any other value. Setting status to "No-show" additionally requires the booking to
 *       currently be "Booked" and its scheduled start time to be at least 15 minutes in the
 *       past — this rejects marking a future or already-resolved booking as a no-show. On
 *       success, the customer is emailed that their appointment was missed.
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
 *                 enum: [Booked, Started, Completed, Collected, Cancelled, No-show]
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status }
 *       403: { description: Manager only, or Supervisor setting a status other than No-show }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.patch("/:id/status", verifyToken, authorizeRoles("Service Center Manager", "Supervisor"), overrideStatus);

/**
 * @swagger
 * /api/bookings/{id}/release:
 *   patch:
 *     summary: Release the vehicle to the customer (Supervisor / Manager only)
 *     description: >
 *       Confirms the customer physically collected the vehicle. Only allowed when the booking
 *       is "Completed" and its invoice is marked Paid — the real payment gate for handover.
 *       On success the booking status becomes "Collected".
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehicle released }
 *       400: { description: Booking not Completed, or invoice not Paid }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.patch("/:id/release", verifyToken, authorizeRoles("Supervisor", "Service Center Manager"), releaseVehicle);

module.exports = router;
