const express = require("express");
const router = express.Router();
const {
  listChargeCatalog, createChargeCatalogItem, updateChargeCatalogItem,
  deactivateChargeCatalogItem, activateChargeCatalogItem,
} = require("../controllers/charge-catalog.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { chargeCatalogItemSchema } = require("../schemas/charge-catalog.schema");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

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
