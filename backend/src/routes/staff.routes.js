const express = require("express");
const router = express.Router();
const { myServices, myPerformance } = require("../controllers/staff.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const serviceStaffOnly = [verifyToken, authorizeRoles("Service Staff")];

/**
 * @swagger
 * tags:
 *   name: StaffDashboard
 *   description: Personal dashboard for Service Staff
 */

/**
 * @swagger
 * /api/staff/my-services:
 *   get:
 *     summary: List all services the authenticated staff member participated in
 *     tags: [StaffDashboard]
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
 *         description: List of services with feedback
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       reservation_id:   { type: integer }
 *                       booking_ref:      { type: string }
 *                       service_date:     { type: string, format: date }
 *                       status:           { type: string }
 *                       customer_name:    { type: string }
 *                       make:             { type: string }
 *                       model:            { type: string }
 *                       plate_no:         { type: string }
 *                       package_name:     { type: string }
 *                       task_type:        { type: string }
 *                       remarks:          { type: string }
 *                       rating:           { type: integer }
 *                       feedback_comment: { type: string }
 *       401: { description: Not authenticated }
 *       403: { description: Service Staff only }
 *       500: { description: Server error }
 */
router.get("/my-services", serviceStaffOnly, myServices);

/**
 * @swagger
 * /api/staff/my-performance:
 *   get:
 *     summary: Get personal performance summary — jobs completed and average rating
 *     tags: [StaffDashboard]
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
 *         description: Performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 performance:
 *                   type: object
 *                   properties:
 *                     jobs_completed: { type: integer }
 *                     avg_rating:     { type: number }
 *                     feedback_count: { type: integer }
 *                     first_service:  { type: string, format: date }
 *                     last_service:   { type: string, format: date }
 *                 rating_breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rating: { type: integer }
 *                       count:  { type: integer }
 *       401: { description: Not authenticated }
 *       403: { description: Service Staff only }
 *       500: { description: Server error }
 */
router.get("/my-performance", serviceStaffOnly, myPerformance);

module.exports = router;
