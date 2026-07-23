const express = require("express");
const router = express.Router();
const {
  listChargeCatalog, createChargeCatalogItem, quickAddChargeCatalogItem, updateChargeCatalogItem,
  deactivateChargeCatalogItem, activateChargeCatalogItem,
} = require("../controllers/charge-catalog.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { chargeCatalogItemSchema, quickAddChargeCatalogItemSchema } = require("../schemas/charge-catalog.schema");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];
const supervisorOrManager = [verifyToken, authorizeRoles("Supervisor", "Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: ChargeCatalog
 *   description: Manager-defined catalog of additional repair/part charges, referenced when itemizing invoices
 */

/**
 * @swagger
 * /api/charge-catalog:
 *   get:
 *     summary: List charge catalog items (active only for non-managers; all for manager)
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of charge catalog items }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, listChargeCatalog);

/**
 * @swagger
 * /api/charge-catalog:
 *   post:
 *     summary: Create a new charge catalog item (Manager only)
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Item created }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/", managerOnly, validate(chargeCatalogItemSchema), createChargeCatalogItem);

/**
 * @swagger
 * /api/charge-catalog/quick-add:
 *   post:
 *     summary: Create (or reuse) a catalog item by name only — no price required (Supervisor / Manager)
 *     description: >
 *       Lets a Supervisor record a one-off "Additional Work" note as a real catalog entry on the
 *       spot, without waiting on a Manager to price it first. Case-insensitive name match against
 *       active items reuses the existing entry instead of creating a duplicate. New items start
 *       at a default_price of 0 and are tagged "Supervisor Added" so a Manager can find and price
 *       them later on the Charge Catalog page.
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Wiper blade replacement" }
 *     responses:
 *       200: { description: Matching active item already existed — reused, not created }
 *       201: { description: New item created }
 *       400: { description: Validation error }
 *       403: { description: Supervisor or Manager only }
 *       500: { description: Server error }
 */
router.post("/quick-add", supervisorOrManager, validate(quickAddChargeCatalogItemSchema), quickAddChargeCatalogItem);

/**
 * @swagger
 * /api/charge-catalog/{id}:
 *   put:
 *     summary: Update a charge catalog item (Manager only)
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Item updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Item not found }
 *       500: { description: Server error }
 */
router.put("/:id", managerOnly, validate(chargeCatalogItemSchema), updateChargeCatalogItem);

/**
 * @swagger
 * /api/charge-catalog/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a charge catalog item (Manager only)
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Item deactivated }
 *       403: { description: Manager only }
 *       404: { description: Item not found }
 *       500: { description: Server error }
 */
router.patch("/:id/deactivate", managerOnly, deactivateChargeCatalogItem);

/**
 * @swagger
 * /api/charge-catalog/{id}/activate:
 *   patch:
 *     summary: Activate a charge catalog item (Manager only)
 *     tags: [ChargeCatalog]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Item activated }
 *       403: { description: Manager only }
 *       404: { description: Item not found }
 *       500: { description: Server error }
 */
router.patch("/:id/activate", managerOnly, activateChargeCatalogItem);

module.exports = router;
