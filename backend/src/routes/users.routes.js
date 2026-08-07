const express = require("express");
const router = express.Router();
const {
  listStaff, getStaffMember, createStaff, updateStaff, deleteStaff,
  setAccountStatus, resetPassword, listCustomers,
  getCustomer, createCustomer, updateCustomer,
} = require("../controllers/users.controller");
const { verifyToken, authorizeRoles } = require("../middlewares/auth.middleware");

const managerOnly = [verifyToken, authorizeRoles("Service Center Manager")];
// Supervisors get read-only access to customer lookups (useful during a walk-in/call) —
// everything that creates, edits, or changes access on an account stays manager-only.
const managerOrSupervisor = [verifyToken, authorizeRoles("Service Center Manager", "Supervisor")];

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management (Manager only)
 */

/**
 * @swagger
 * /api/users/staff:
 *   get:
 *     summary: List all staff accounts (Manager only)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of staff members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StaffUser'
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.get("/staff", managerOnly, listStaff);

/**
 * @swagger
 * /api/users/customers:
 *   get:
 *     summary: List all customer accounts (Manager or Supervisor)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:        { type: integer }
 *                       email:          { type: string }
 *                       account_status: { type: string }
 *                       full_name:      { type: string }
 *                       phone:          { type: string }
 *                       address:        { type: string }
 *       403: { description: Manager or Supervisor only }
 *       500: { description: Server error }
 */
router.get("/customers", managerOrSupervisor, listCustomers);

/**
 * @swagger
 * /api/users/customers/{id}:
 *   get:
 *     summary: Get a single customer's profile, vehicles, and recent bookings (Manager or Supervisor)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Customer details }
 *       403: { description: Manager or Supervisor only }
 *       404: { description: Customer not found }
 *       500: { description: Server error }
 */
router.get("/customers/:id", managerOrSupervisor, getCustomer);

/**
 * @swagger
 * /api/users/customers:
 *   post:
 *     summary: Create a new customer account (Manager only)
 *     description: No password is taken from the manager — an invite email is sent so the customer sets their own password, same as staff account creation.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, full_name, phone]
 *             properties:
 *               email:           { type: string, example: kamal@example.com }
 *               full_name:       { type: string, example: Kamal Silva }
 *               phone:           { type: string, example: "+94771234567" }
 *               secondary_phone: { type: string, example: "0711234567" }
 *               address:         { type: string, example: "12 Galle Road, Colombo" }
 *     responses:
 *       201: { description: Customer account created }
 *       400: { description: Validation error or email taken }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/customers", managerOnly, createCustomer);

/**
 * @swagger
 * /api/users/customers/{id}:
 *   put:
 *     summary: Update a customer's contact details (Manager only)
 *     tags: [Users]
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
 *             required: [full_name, phone]
 *             properties:
 *               full_name:       { type: string, example: Kamal Silva }
 *               email:           { type: string, example: kamal@example.com }
 *               phone:           { type: string, example: "+94771234567" }
 *               secondary_phone: { type: string, example: "0711234567" }
 *               address:         { type: string, example: "12 Galle Road, Colombo" }
 *     responses:
 *       200: { description: Customer updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Customer not found }
 *       500: { description: Server error }
 */
router.put("/customers/:id", managerOnly, updateCustomer);

/**
 * @swagger
 * /api/users/staff/{id}:
 *   get:
 *     summary: Get a single staff member (Manager only)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Staff member details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   $ref: '#/components/schemas/StaffUser'
 *       403: { description: Manager only }
 *       404: { description: Staff not found }
 *       500: { description: Server error }
 */
router.get("/staff/:id", managerOnly, getStaffMember);

/**
 * @swagger
 * /api/users/staff:
 *   post:
 *     summary: Create a new staff account (Manager only)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStaffInput'
 *     responses:
 *       201: { description: Staff account created }
 *       400: { description: Validation error or email taken }
 *       403: { description: Manager only }
 *       500: { description: Server error }
 */
router.post("/staff", managerOnly, createStaff);

/**
 * @swagger
 * /api/users/staff/{id}:
 *   put:
 *     summary: Update a staff member's details (Manager only)
 *     tags: [Users]
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
 *             required: [full_name]
 *             properties:
 *               full_name: { type: string, example: Nimal Perera }
 *               phone_no:  { type: string, example: "+94771234567" }
 *               email:     { type: string, example: nimal@drivewell.lk }
 *     responses:
 *       200: { description: Staff updated }
 *       400: { description: Validation error }
 *       403: { description: Manager only }
 *       404: { description: Staff not found }
 *       500: { description: Server error }
 */
router.put("/staff/:id", managerOnly, updateStaff);

/**
 * @swagger
 * /api/users/staff/{id}:
 *   delete:
 *     summary: Permanently delete a staff account, of any status (Manager only)
 *     description: Irreversible — deletes the account and revokes login access for good. Past invoices, service records, and job assignments are preserved with a name snapshot taken at the time they were created, so historical data keeps reading correctly. A manager cannot delete their own account.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Staff account permanently deleted }
 *       400: { description: Attempted to delete your own account }
 *       403: { description: Manager only }
 *       404: { description: Staff not found }
 *       500: { description: Server error }
 */
router.delete("/staff/:id", managerOnly, deleteStaff);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Activate or deactivate any staff or customer account (Manager only)
 *     tags: [Users]
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
 *             required: [account_status]
 *             properties:
 *               account_status: { type: string, enum: [active, inactive], example: inactive }
 *     responses:
 *       200: { description: Account status updated }
 *       400: { description: Invalid status value }
 *       403: { description: Manager only }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.patch("/:id/status", managerOnly, setAccountStatus);

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   patch:
 *     summary: Reset a staff member's password (Manager only)
 *     tags: [Users]
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
 *             required: [new_password]
 *             properties:
 *               new_password: { type: string, example: newpass123 }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Password too short }
 *       403: { description: Manager only }
 *       404: { description: Staff not found }
 *       500: { description: Server error }
 */
router.patch("/:id/reset-password", managerOnly, resetPassword);

module.exports = router;
