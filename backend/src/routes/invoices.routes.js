const express = require("express");
const router = express.Router();
const { listInvoices, getInvoice, createInvoice, updatePaymentStatus } = require("../controllers/invoices.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const cashierOrManager = [verifyToken, authorizeRoles("Cashier", "Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice and payment management
 */

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List invoices. Customers see their own; Cashier/Manager see all.
 *     tags: [Invoices]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: payment_status
 *         schema: { type: string, enum: [Paid, Unpaid] }
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get("/", verifyToken, listInvoices);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get a single invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoice:
 *                   $ref: '#/components/schemas/Invoice'
 *       401: { description: Not authenticated }
 *       403: { description: Access denied }
 *       404: { description: Invoice not found }
 *       500: { description: Server error }
 */
router.get("/:id", verifyToken, getInvoice);

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Generate an invoice for a completed service (Cashier / Manager only)
 *     tags: [Invoices]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvoiceInput'
 *     responses:
 *       201: { description: Invoice created }
 *       400: { description: Validation error or booking not completed }
 *       403: { description: Cashier or Manager only }
 *       500: { description: Server error }
 */
router.post("/", cashierOrManager, createInvoice);

/**
 * @swagger
 * /api/invoices/{id}/payment:
 *   patch:
 *     summary: Update payment status for an invoice (Cashier / Manager only)
 *     tags: [Invoices]
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
 *             required: [payment_status]
 *             properties:
 *               payment_status: { type: string, enum: [Paid, Unpaid], example: Paid }
 *               payment_method: { type: string, example: Cash }
 *     responses:
 *       200: { description: Payment status updated }
 *       400: { description: Invalid payment_status }
 *       403: { description: Cashier or Manager only }
 *       404: { description: Invoice not found }
 *       500: { description: Server error }
 */
router.patch("/:id/payment", cashierOrManager, updatePaymentStatus);

module.exports = router;
