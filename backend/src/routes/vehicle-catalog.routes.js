const express = require("express");
const router = express.Router();
const {
  listMakesAdmin, createMake, updateMake, deleteMake,
  listModelsAdmin, createModel, updateModel, deleteModel,
  listTypesAdmin, createType, updateType, deleteType,
  listPendingSubmissions, resolvePendingSubmissions,
} = require("../controllers/vehicle-catalog.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  vehicleMakeSchema, vehicleModelSchema, vehicleTypeSchema, resolvePendingSchema,
} = require("../schemas/vehicle-catalog.schema");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: VehicleCatalog
 *   description: Manager tools for maintaining the vehicle make/model/type catalog and resolving customer-submitted custom values (Manager only)
 */

/**
 * @swagger
 * /api/admin/vehicle-catalog/makes:
 *   get:
 *     summary: List all vehicle makes with model/vehicle counts (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of makes }
 *       401: { description: Not authenticated }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/makes", managerOnly, listMakesAdmin);

/**
 * @swagger
 * /api/admin/vehicle-catalog/makes:
 *   post:
 *     summary: Create a vehicle make (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Make created }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/makes", managerOnly, validate(vehicleMakeSchema), createMake);

/**
 * @swagger
 * /api/admin/vehicle-catalog/makes/{id}:
 *   put:
 *     summary: Rename a vehicle make (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Make updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Make not found }
 *       500: { description: Server error }
 */
router.put("/makes/:id", managerOnly, validate(vehicleMakeSchema), updateMake);

/**
 * @swagger
 * /api/admin/vehicle-catalog/makes/{id}:
 *   delete:
 *     summary: Delete a vehicle make — only allowed if no models or vehicles reference it (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Make deleted }
 *       403: { description: Manager only }
 *       404: { description: Make not found }
 *       409: { description: Make still has models/vehicles attached }
 *       500: { description: Server error }
 */
router.delete("/makes/:id", managerOnly, deleteMake);

/**
 * @swagger
 * /api/admin/vehicle-catalog/models:
 *   get:
 *     summary: List vehicle models, optionally filtered by make (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: make_id
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of models }
 *       401: { description: Not authenticated }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/models", managerOnly, listModelsAdmin);

/**
 * @swagger
 * /api/admin/vehicle-catalog/models:
 *   post:
 *     summary: Create a vehicle model (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Model created }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/models", managerOnly, validate(vehicleModelSchema), createModel);

/**
 * @swagger
 * /api/admin/vehicle-catalog/models/{id}:
 *   put:
 *     summary: Update a vehicle model (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Model updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Model not found }
 *       500: { description: Server error }
 */
router.put("/models/:id", managerOnly, validate(vehicleModelSchema), updateModel);

/**
 * @swagger
 * /api/admin/vehicle-catalog/models/{id}:
 *   delete:
 *     summary: Delete a vehicle model — only allowed if no vehicles reference it (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Model deleted }
 *       403: { description: Manager only }
 *       404: { description: Model not found }
 *       409: { description: Model still has vehicles attached }
 *       500: { description: Server error }
 */
router.delete("/models/:id", managerOnly, deleteModel);

/**
 * @swagger
 * /api/admin/vehicle-catalog/types:
 *   get:
 *     summary: List all vehicle types with model/vehicle counts, unfiltered (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of types }
 *       401: { description: Not authenticated }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/types", managerOnly, listTypesAdmin);

/**
 * @swagger
 * /api/admin/vehicle-catalog/types:
 *   post:
 *     summary: Create a vehicle type (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Type created }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/types", managerOnly, validate(vehicleTypeSchema), createType);

/**
 * @swagger
 * /api/admin/vehicle-catalog/types/{id}:
 *   put:
 *     summary: Rename a vehicle type (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Type updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Type not found }
 *       500: { description: Server error }
 */
router.put("/types/:id", managerOnly, validate(vehicleTypeSchema), updateType);

/**
 * @swagger
 * /api/admin/vehicle-catalog/types/{id}:
 *   delete:
 *     summary: Delete a vehicle type — only allowed if no models or vehicles reference it (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Type deleted }
 *       403: { description: Manager only }
 *       404: { description: Type not found }
 *       409: { description: Type still has models/vehicles attached }
 *       500: { description: Server error }
 */
router.delete("/types/:id", managerOnly, deleteType);

/**
 * @swagger
 * /api/admin/vehicle-catalog/pending-submissions:
 *   get:
 *     summary: List vehicles whose make/model was typed as free text by the customer and still needs to be matched to the catalog (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of pending submissions }
 *       401: { description: Not authenticated }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/pending-submissions", managerOnly, listPendingSubmissions);

/**
 * @swagger
 * /api/admin/vehicle-catalog/pending-submissions/resolve:
 *   post:
 *     summary: Link one or more pending vehicles to a real make/model, clearing their pending status (Manager only)
 *     tags: [VehicleCatalog]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vehicle_ids: { type: array, items: { type: integer } }
 *               make_id: { type: integer }
 *               model_id: { type: integer }
 *     responses:
 *       200: { description: Vehicles resolved }
 *       400: { description: Validation error, or model does not belong to the given make }
 *       403: { description: Manager only }
 *       404: { description: Model not found }
 *       500: { description: Server error }
 */
router.post("/pending-submissions/resolve", managerOnly, validate(resolvePendingSchema), resolvePendingSubmissions);

module.exports = router;
