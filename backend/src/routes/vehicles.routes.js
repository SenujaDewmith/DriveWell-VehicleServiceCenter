const express = require("express");
const router = express.Router();
const {
  listVehicles, addVehicle, updateVehicle, deleteVehicle,
  listMakes, listModels, listVehicleTypes,
} = require("../controllers/vehicles.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const customerOnly = [verifyToken, authorizeRoles("Customer")];

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
 *     summary: Delete a vehicle (must belong to the authenticated customer)
 *     tags: [Vehicles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehicle deleted }
 *       400: { description: Vehicle has existing bookings }
 *       401: { description: Not authenticated }
 *       404: { description: Vehicle not found }
 *       500: { description: Server error }
 */
router.delete("/:id", customerOnly, deleteVehicle);

module.exports = router;
