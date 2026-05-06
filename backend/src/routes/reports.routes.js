const express = require("express");
const router = express.Router();
const { revenueReport, volumeReport, staffPerformanceReport, activityLog } = require("../controllers/reports.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Management reporting (Manager only)
 */

/**
 * @swagger
 * /api/reports/revenue:
 *   get:
 *     summary: Revenue report — total, by package, and by date (Manager only)
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: "2025-01-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: "2025-12-31" }
 *     responses:
 *       200:
 *         description: Revenue data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_revenue:   { type: number }
 *                     total_invoices:  { type: integer }
 *                     paid_revenue:    { type: number }
 *                     unpaid_revenue:  { type: number }
 *                 by_package:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       package_name: { type: string }
 *                       count:        { type: integer }
 *                       revenue:      { type: number }
 *                 by_date:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service_date: { type: string, format: date }
 *                       revenue:      { type: number }
 *                       count:        { type: integer }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/revenue", managerOnly, revenueReport);

/**
 * @swagger
 * /api/reports/volume:
 *   get:
 *     summary: Service volume report — by status, by package, by date (Manager only)
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Volume data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 by_status:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status: { type: string }
 *                       count:  { type: integer }
 *                 by_package:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       package_name: { type: string }
 *                       count:        { type: integer }
 *                 by_date:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service_date: { type: string, format: date }
 *                       count:        { type: integer }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/volume", managerOnly, volumeReport);

/**
 * @swagger
 * /api/reports/staff-performance:
 *   get:
 *     summary: Staff performance report — jobs completed and average rating (Manager only)
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Staff performance data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff_performance:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       staff_id:       { type: integer }
 *                       full_name:      { type: string }
 *                       email:          { type: string }
 *                       jobs_completed: { type: integer }
 *                       avg_rating:     { type: number }
 *                       feedback_count: { type: integer }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/staff-performance", managerOnly, staffPerformanceReport);

/**
 * @swagger
 * /api/reports/activity:
 *   get:
 *     summary: Activity log of key system actions (Manager only)
 *     tags: [Reports]
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
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: Activity log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       log_id:      { type: integer }
 *                       email:       { type: string }
 *                       action:      { type: string }
 *                       entity_type: { type: string }
 *                       entity_id:   { type: integer }
 *                       created_at:  { type: string, format: date-time }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/activity", managerOnly, activityLog);

module.exports = router;
