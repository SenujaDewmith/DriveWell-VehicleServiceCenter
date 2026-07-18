const express = require("express");
const router = express.Router();
const { getConfig, updateConfig, addBlockedTime, deleteBlockedTime } = require("../controllers/config.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Business hours and scheduling configuration (Manager only)
 */

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get working configuration and all blocked times
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   $ref: '#/components/schemas/WorkingConfig'
 *                 blocked_times:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlockedTime'
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, getConfig);

/**
 * @swagger
 * /api/config:
 *   put:
 *     summary: Update working days and business hours (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [working_days, day_start_time, day_end_time]
 *             properties:
 *               working_days:            { type: string, example: "1,2,3,4,5", description: "Comma-separated: 0=Sun, 1=Mon … 6=Sat" }
 *               day_start_time:          { type: string, example: "08:00", description: "HH:MM format" }
 *               day_end_time:            { type: string, example: "18:00", description: "HH:MM format; must be after day_start_time" }
 *               same_day_cutoff_minutes: { type: integer, example: 240, description: "Minutes before closing that same-day bookings stop being accepted" }
 *     responses:
 *       200: { description: Config updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.put("/", managerOnly, updateConfig);

/**
 * @swagger
 * /api/config/blocked-times:
 *   post:
 *     summary: Add a blocked/unavailable time period (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_time, end_time]
 *             properties:
 *               date:       { type: string, format: date, example: "2026-07-20", description: "Omit for a recurring block that applies every working day (e.g. lunch break)" }
 *               start_time: { type: string, example: "12:00", description: "HH:MM format" }
 *               end_time:   { type: string, example: "13:00", description: "HH:MM format; must be after start_time" }
 *               reason:     { type: string, example: "Lunch break" }
 *     responses:
 *       201: { description: Blocked time added }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/blocked-times", managerOnly, addBlockedTime);

/**
 * @swagger
 * /api/config/blocked-times/{id}:
 *   delete:
 *     summary: Remove a blocked/unavailable time period (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Blocked time removed }
 *       403: { description: Manager only }
 *       404: { description: Blocked time not found }
 *       500: { description: Server error }
 */
router.delete("/blocked-times/:id", managerOnly, deleteBlockedTime);

module.exports = router;
