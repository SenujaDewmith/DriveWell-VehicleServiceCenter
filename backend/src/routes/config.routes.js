const express = require("express");
const router = express.Router();
const { getConfig, updateConfig, addSlot, toggleSlot, deleteSlot } = require("../controllers/config.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Working hours and scheduling configuration (Manager only)
 */

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get working configuration and all time slots
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
 *                 slots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TimeSlot'
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, getConfig);

/**
 * @swagger
 * /api/config:
 *   put:
 *     summary: Update working days and daily capacity (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [daily_capacity, working_days]
 *             properties:
 *               daily_capacity: { type: integer, example: 10 }
 *               working_days:   { type: string, example: "1,2,3,4,5", description: "Comma-separated: 0=Sun, 1=Mon … 6=Sat" }
 *     responses:
 *       200: { description: Config updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.put("/", managerOnly, updateConfig);

/**
 * @swagger
 * /api/config/slots:
 *   post:
 *     summary: Add a new time slot (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slot_time]
 *             properties:
 *               slot_time: { type: string, example: "07:00", description: "HH:MM format" }
 *     responses:
 *       201: { description: Slot added }
 *       400: { description: Slot already exists }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/slots", managerOnly, addSlot);

/**
 * @swagger
 * /api/config/slots/{id}:
 *   patch:
 *     summary: Enable or disable a time slot (Manager only)
 *     tags: [Config]
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
 *             required: [is_active]
 *             properties:
 *               is_active: { type: boolean, example: false }
 *     responses:
 *       200: { description: Slot updated }
 *       403: { description: Manager only }
 *       404: { description: Slot not found }
 *       500: { description: Server error }
 */
router.patch("/slots/:id", managerOnly, toggleSlot);

/**
 * @swagger
 * /api/config/slots/{id}:
 *   delete:
 *     summary: Delete a time slot (Manager only)
 *     tags: [Config]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Slot deleted }
 *       403: { description: Manager only }
 *       404: { description: Slot not found }
 *       500: { description: Server error }
 */
router.delete("/slots/:id", managerOnly, deleteSlot);

module.exports = router;
