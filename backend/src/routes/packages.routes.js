const express = require("express");
const router = express.Router();
const {
  listPackages, getPackage, createPackage, updatePackage, deactivatePackage, activatePackage,
} = require("../controllers/packages.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { packageSchema } = require("../schemas/packages.schema");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Packages
 *   description: Service package management
 */

/**
 * @swagger
 * /api/packages:
 *   get:
 *     summary: List service packages (active only for customers; all for manager)
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServicePackage'
 *       500: { description: Server error }
 */
router.get("/", verifyToken, listPackages);

/**
 * @swagger
 * /api/packages/{id}:
 *   get:
 *     summary: Get a single service package by ID
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Package details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 package:
 *                   $ref: '#/components/schemas/ServicePackage'
 *       404: { description: Package not found }
 *       500: { description: Server error }
 */
router.get("/:id", verifyToken, getPackage);

/**
 * @swagger
 * /api/packages:
 *   post:
 *     summary: Create a new service package (Manager only)
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServicePackageInput'
 *     responses:
 *       201: { description: Package created }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/", managerOnly, validate(packageSchema), createPackage);

/**
 * @swagger
 * /api/packages/{id}:
 *   put:
 *     summary: Update a service package (Manager only)
 *     tags: [Packages]
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
 *             $ref: '#/components/schemas/ServicePackageInput'
 *     responses:
 *       200: { description: Package updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Package not found }
 *       500: { description: Server error }
 */
router.put("/:id", managerOnly, validate(packageSchema), updatePackage);

/**
 * @swagger
 * /api/packages/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a service package (Manager only)
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Package deactivated }
 *       403: { description: Manager only }
 *       404: { description: Package not found }
 *       500: { description: Server error }
 */
router.patch("/:id/deactivate", managerOnly, deactivatePackage);

/**
 * @swagger
 * /api/packages/{id}/activate:
 *   patch:
 *     summary: Activate a service package (Manager only)
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Package activated }
 *       403: { description: Manager only }
 *       404: { description: Package not found }
 *       500: { description: Server error }
 */
router.patch("/:id/activate", managerOnly, activatePackage);

module.exports = router;
