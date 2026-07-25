const express = require("express");
const router = express.Router();
const { listDetachedVehicles, forceTransferVehicle } = require("../controllers/vehicle-transfers.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: VehicleAdmin
 *   description: Staff-facing vehicle ownership transfer tools (Manager only)
 */

/**
 * @swagger
 * /api/admin/vehicles/detached:
 *   get:
 *     summary: List all currently-detached vehicles across every customer, optionally filtered by plate
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: plate
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of detached vehicles }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 *       500: { description: Server error }
 */
router.get("/detached", managerOnly, listDetachedVehicles);

/**
 * @swagger
 * /api/admin/vehicles/force-transfer:
 *   post:
 *     summary: Force-transfer a vehicle (active or detached) to a new customer account by plate number
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plate_no: { type: string }
 *               new_owner_email: { type: string }
 *     responses:
 *       200: { description: Vehicle transferred }
 *       400: { description: Validation error or vehicle has an unresolved booking }
 *       404: { description: Vehicle or customer not found }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 *       500: { description: Server error }
 */
router.post("/force-transfer", managerOnly, forceTransferVehicle);

module.exports = router;
