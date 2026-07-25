const express = require("express");
const router = express.Router();
const {
  listVehicles, addVehicle, updateVehicle, detachVehicle,
  lookupPlate, claimVehicle, listMyDetachedVehicles, restoreVehicle,
  submitTransferRequest, listMyTransferRequests,
  listMakes, listModels, listVehicleTypes,
} = require("../controllers/vehicles.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const { uploadTransferDocs } = require("../middlewares/upload.middleware");

const customerOnly = [verifyToken, authorizeRoles("Customer")];

const handleTransferDocsUpload = (req, res, next) => {
  uploadTransferDocs.fields([{ name: "logbook_photo", maxCount: 1 }, { name: "nic_photo", maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || "Document upload failed" });
    next();
  });
};

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Customer vehicle management
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: List all vehicles belonging to the authenticated customer
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *       401: { description: Not authenticated }
 *       403: { description: Not a customer }
 *       500: { description: Server error }
 */
router.get("/", customerOnly, listVehicles);

/**
 * @swagger
 * /api/vehicles/makes:
 *   get:
 *     summary: List all vehicle makes (for dropdown selection)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of makes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 makes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       make_id: { type: integer }
 *                       name:    { type: string }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/makes", customerOnly, listMakes);

/**
 * @swagger
 * /api/vehicles/models:
 *   get:
 *     summary: List vehicle models, optionally filtered by make (for dropdown selection)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: make_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model_id:        { type: integer }
 *                       name:            { type: string }
 *                       make_id:         { type: integer }
 *                       vehicle_type_id: { type: integer, nullable: true }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/models", customerOnly, listModels);

/**
 * @swagger
 * /api/vehicles/types:
 *   get:
 *     summary: List all vehicle types (for dropdown selection)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of vehicle types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 types:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type_id: { type: integer }
 *                       name:    { type: string }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/types", customerOnly, listVehicleTypes);

/**
 * @swagger
 * /api/vehicles/detached:
 *   get:
 *     summary: List the authenticated customer's own vehicles that are currently detached (removed but unclaimed)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of detached vehicles }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/detached", customerOnly, listMyDetachedVehicles);

/**
 * @swagger
 * /api/vehicles/lookup/{plate_no}:
 *   get:
 *     summary: Look up a plate number to check whether it's unregistered, claimable, or actively owned by someone else
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plate_no
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lookup result }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/lookup/:plate_no", customerOnly, lookupPlate);

/**
 * @swagger
 * /api/vehicles/claim:
 *   post:
 *     summary: Claim an existing, currently-detached vehicle by plate number, inheriting its service history
 *     tags: [Vehicles]
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
 *     responses:
 *       200: { description: Vehicle claimed }
 *       404: { description: No vehicle found with that plate }
 *       409: { description: Vehicle is actively owned by someone else, or was just claimed }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.post("/claim", customerOnly, claimVehicle);

/**
 * @swagger
 * /api/vehicles/transfer-requests/mine:
 *   get:
 *     summary: List the authenticated customer's own submitted vehicle transfer requests
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of the customer's transfer requests }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/transfer-requests/mine", customerOnly, listMyTransferRequests);

/**
 * @swagger
 * /api/vehicles/transfer-requests:
 *   post:
 *     summary: Submit a request to claim a vehicle actively owned by another customer, with logbook + NIC verification photos
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               plate_no: { type: string }
 *               logbook_photo: { type: string, format: binary }
 *               nic_photo: { type: string, format: binary }
 *     responses:
 *       201: { description: Transfer request submitted }
 *       400: { description: Validation error }
 *       404: { description: No vehicle found with that plate }
 *       409: { description: A transfer request for this vehicle is already pending }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.post("/transfer-requests", customerOnly, handleTransferDocsUpload, submitTransferRequest);

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Add a new vehicle for the authenticated customer
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleInput'
 *     responses:
 *       201:
 *         description: Vehicle added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 vehicle:
 *                   $ref: '#/components/schemas/Vehicle'
 *       400: { description: Validation error or duplicate plate number }
 *       401: { description: Not authenticated }
 *       403: { description: Not a customer }
 *       500: { description: Server error }
 */
router.post("/", customerOnly, addVehicle);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Update a vehicle (must belong to the authenticated customer)
 *     tags: [Vehicles]
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
 *             $ref: '#/components/schemas/VehicleInput'
 *     responses:
 *       200: { description: Vehicle updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       404: { description: Vehicle not found }
 *       500: { description: Server error }
 */
router.put("/:id", customerOnly, updateVehicle);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Detach a vehicle from the authenticated customer's account (reversible until someone else claims it)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehicle detached }
 *       400: { description: Vehicle has an upcoming or in-progress booking }
 *       401: { description: Not authenticated }
 *       404: { description: Vehicle not found }
 *       500: { description: Server error }
 */
router.delete("/:id", customerOnly, detachVehicle);

/**
 * @swagger
 * /api/vehicles/{id}/restore:
 *   post:
 *     summary: Restore a vehicle the authenticated customer previously detached, as long as no one else has claimed it yet
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehicle restored }
 *       403: { description: Not authorized to restore this vehicle }
 *       404: { description: Vehicle not found }
 *       409: { description: Vehicle already claimed by another customer }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.post("/:id/restore", customerOnly, restoreVehicle);

module.exports = router;
