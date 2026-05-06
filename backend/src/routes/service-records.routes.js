const express = require("express");
const router = express.Router();
const {
  getServiceRecord, createServiceRecord, updateServiceRecord,
  updateStatus, assignStaff, removeStaffAssignment,
} = require("../controllers/service-records.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const supervisorOrManager = [verifyToken, authorizeRoles("Supervisor", "Service Center Manager")];

/**
 * @swagger
 * tags:
 *   name: ServiceRecords
 *   description: Service record management (Supervisor / Manager)
 */

/**
 * @swagger
 * /api/service-records/{booking_id}:
 *   get:
 *     summary: Get the service record and staff assignments for a booking
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service record with staff assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 record:
 *                   $ref: '#/components/schemas/ServiceRecord'
 *                 assignments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       assignment_id: { type: integer }
 *                       staff_id:      { type: integer }
 *                       staff_name:    { type: string }
 *                       task_type:     { type: string }
 *       401: { description: Not authenticated }
 *       404: { description: Service record not found }
 *       500: { description: Server error }
 */
router.get("/:booking_id", verifyToken, getServiceRecord);

/**
 * @swagger
 * /api/service-records/{booking_id}:
 *   post:
 *     summary: Start a service — creates a service record and sets status to Started (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:            { type: string, example: "Initial inspection done" }
 *               additional_work:    { type: string, example: "Brake pads need replacement" }
 *               consumables:        { type: string, example: "5W-30 engine oil" }
 *               additional_charges: { type: number, example: 1500 }
 *     responses:
 *       201: { description: Service record created }
 *       400: { description: Record already exists or invalid state }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.post("/:booking_id", supervisorOrManager, createServiceRecord);

/**
 * @swagger
 * /api/service-records/{booking_id}:
 *   put:
 *     summary: Update service record remarks and notes (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:            { type: string }
 *               additional_work:    { type: string }
 *               consumables:        { type: string }
 *               additional_charges: { type: number }
 *               quality_checked:    { type: boolean }
 *     responses:
 *       200: { description: Service record updated }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Service record not found }
 *       500: { description: Server error }
 */
router.put("/:booking_id", supervisorOrManager, updateServiceRecord);

/**
 * @swagger
 * /api/service-records/{booking_id}/status:
 *   patch:
 *     summary: Advance the service status (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Started, "In Progress", Completed, "Ready for Pickup"]
 *                 example: "In Progress"
 *     responses:
 *       200: { description: Status updated and email sent for Completed/Ready for Pickup }
 *       400: { description: Invalid status }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Booking not found }
 *       500: { description: Server error }
 */
router.patch("/:booking_id/status", supervisorOrManager, updateStatus);

/**
 * @swagger
 * /api/service-records/{booking_id}/staff:
 *   post:
 *     summary: Assign a staff member to a service task (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staff_id, task_type]
 *             properties:
 *               staff_id:  { type: integer, example: 7 }
 *               task_type: { type: string, example: "Body Wash" }
 *     responses:
 *       201: { description: Staff assigned }
 *       400: { description: Missing fields }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Service record not found }
 *       500: { description: Server error }
 */
router.post("/:booking_id/staff", supervisorOrManager, assignStaff);

/**
 * @swagger
 * /api/service-records/assignments/{assignment_id}:
 *   delete:
 *     summary: Remove a staff assignment (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: assignment_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Assignment removed }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Assignment not found }
 *       500: { description: Server error }
 */
router.delete("/assignments/:assignment_id", supervisorOrManager, removeStaffAssignment);

module.exports = router;
