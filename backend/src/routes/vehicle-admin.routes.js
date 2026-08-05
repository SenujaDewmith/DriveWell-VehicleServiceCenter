const express = require("express");
const router = express.Router();
const {
  listDetachedVehicles, forceTransferVehicle,
  listTransferRequests, getTransferRequestDocument, approveTransferRequest, rejectTransferRequest,
} = require("../controllers/vehicle-transfers.controller");
const { searchVehiclesAdmin, getVehicleAdmin, listRecentVehiclesAdmin } = require("../controllers/vehicles.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];
// Vehicle History (lookup, view, and PDF hand-out) is open to Supervisors too — they already
// see the same full booking/service-record/invoice detail via /api/bookings, so restricting
// this page's own endpoints to Manager-only would just push them back to piecing the same
// data together from All Bookings instead.
const managerOrSupervisor = [verifyToken, authorizeRoles("Service Center Manager", "Supervisor")];

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
 * /api/admin/vehicles/search:
 *   get:
 *     summary: Search all vehicles (active or detached, any owner) by plate number or make/model — for the Vehicle History lookup (Manager or Supervisor)
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search text (min 2 characters) — matched against plate number, make, and model
 *     responses:
 *       200: { description: Matching vehicles (capped at 20), each with current owner info if any }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager or supervisor }
 *       500: { description: Server error }
 */
router.get("/search", managerOrSupervisor, searchVehiclesAdmin);

/**
 * @swagger
 * /api/admin/vehicles/recent:
 *   get:
 *     summary: Default browse list for the Vehicle History page before a search is typed — today's appointment vehicles, falling back to the most recently serviced vehicles overall (Manager or Supervisor)
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Up to 10 vehicles, with `source` indicating which list is returned ("today", "recent", or "none")
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager or supervisor }
 *       500: { description: Server error }
 */
router.get("/recent", managerOrSupervisor, listRecentVehiclesAdmin);

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

/**
 * @swagger
 * /api/admin/vehicles/transfer-requests:
 *   get:
 *     summary: List vehicle transfer requests/history, optionally filtered by status (comma-separated for multiple, e.g. "Approved,Rejected")
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "Approved,Rejected" }
 *       - in: query
 *         name: plate
 *         schema: { type: string }
 *         description: Filter by plate number (partial match)
 *     responses:
 *       200: { description: List of transfer requests }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 *       500: { description: Server error }
 */
router.get("/transfer-requests", managerOnly, listTransferRequests);

/**
 * @swagger
 * /api/admin/vehicles/transfer-requests/{id}/documents/{type}:
 *   get:
 *     summary: Stream a transfer request's verification photo (registration_book or nic) — auth-gated, never public
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [registration_book, nic] }
 *     responses:
 *       200: { description: Image file }
 *       404: { description: Request or document not found }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 */
router.get("/transfer-requests/:id/documents/:type", managerOnly, getTransferRequestDocument);

/**
 * @swagger
 * /api/admin/vehicles/transfer-requests/{id}/approve:
 *   post:
 *     summary: Approve a pending transfer request, transferring the vehicle to the requester
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Request approved and vehicle transferred }
 *       400: { description: Vehicle has an unresolved booking, or requester already owns it }
 *       404: { description: Request or vehicle not found }
 *       409: { description: Request already resolved, or ownership changed since filing }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 */
router.post("/transfer-requests/:id/approve", managerOnly, approveTransferRequest);

/**
 * @swagger
 * /api/admin/vehicles/transfer-requests/{id}/reject:
 *   post:
 *     summary: Reject a pending transfer request
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Request rejected }
 *       404: { description: Request not found }
 *       409: { description: Request already resolved }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager }
 */
router.post("/transfer-requests/:id/reject", managerOnly, rejectTransferRequest);

/**
 * @swagger
 * /api/admin/vehicles/{id}:
 *   get:
 *     summary: Get a single vehicle by id (any owner/status) — backs the Vehicle History page (Manager or Supervisor)
 *     tags: [VehicleAdmin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehicle found }
 *       404: { description: Vehicle not found }
 *       401: { description: Not authenticated }
 *       403: { description: Not a manager or supervisor }
 *       500: { description: Server error }
 */
// Registered last: a param route this generic would otherwise shadow the literal
// routes above it (e.g. "/search" matching :id="search") if placed earlier.
router.get("/:id", managerOrSupervisor, getVehicleAdmin);

module.exports = router;
