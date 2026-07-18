const express = require("express");
const router = express.Router();
const {
  getServiceRecord, createServiceRecord, updateServiceRecord,
  updateStatus, assignStaff, updateAssignment, removeStaffAssignment,
  addServiceRecordItem, removeServiceRecordItem, listServiceStaffOptions,
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
 * /api/service-records/staff-options:
 *   get:
 *     summary: List active Service Staff for the assignment dropdown (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: List of service staff }
 *       403: { description: Supervisor or Manager only }
 *       500: { description: Server error }
 */
router.get("/staff-options", supervisorOrManager, listServiceStaffOptions);

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
 *                       work_note:     { type: string }
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
 *     summary: Assign a staff contributor to a service (max 3 per service) (Supervisor / Manager)
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
 *             required: [staff_id]
 *             properties:
 *               staff_id:  { type: integer, example: 7 }
 *               work_note: { type: string, example: "Did the interior vacuum and dashboard cleaning" }
 *     responses:
 *       201: { description: Staff assigned }
 *       400: { description: Missing staff_id, already at the 3-staff limit, or staff already assigned }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Service record not found }
 *       500: { description: Server error }
 */
router.post("/:booking_id/staff", supervisorOrManager, assignStaff);

/**
 * @swagger
 * /api/service-records/assignments/{assignment_id}:
 *   put:
 *     summary: Update a staff assignment's staff member or work note (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: assignment_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               staff_id:  { type: integer, example: 7 }
 *               work_note: { type: string, example: "Did the interior vacuum and dashboard cleaning" }
 *     responses:
 *       200: { description: Assignment updated }
 *       400: { description: Staff already assigned to this service }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Assignment not found }
 *       500: { description: Server error }
 */
router.put("/assignments/:assignment_id", supervisorOrManager, updateAssignment);

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

/**
 * @swagger
 * /api/service-records/{booking_id}/items:
 *   post:
 *     summary: Add a structured additional-work/parts note to a service record (Supervisor / Manager)
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
 *               catalog_item_id: { type: integer, example: 3 }
 *               description:     { type: string, example: "Rear brake pads worn — needs replacement" }
 *               quantity:        { type: integer, example: 1 }
 *     responses:
 *       201: { description: Service item added }
 *       400: { description: Missing catalog_item_id and description }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Service record not found }
 *       500: { description: Server error }
 */
router.post("/:booking_id/items", supervisorOrManager, addServiceRecordItem);

/**
 * @swagger
 * /api/service-records/items/{item_id}:
 *   delete:
 *     summary: Remove a structured service item note (Supervisor / Manager)
 *     tags: [ServiceRecords]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Service item removed }
 *       403: { description: Supervisor or Manager only }
 *       404: { description: Service item not found }
 *       500: { description: Server error }
 */
router.delete("/items/:item_id", supervisorOrManager, removeServiceRecordItem);

module.exports = router;
