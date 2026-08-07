const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");
const { hashResetToken } = require("../utils/resetToken");
const { sendAccountSetupEmail, sendCustomerAccountSetupEmail } = require("../services/email.service");
const { isValidPhone, isValidSriLankanPhone } = require("../lib/phone");

const STAFF_ROLES = [1, 2, 3, 4];
const CUSTOMER_ROLE_ID = 5;
const MANAGEABLE_ROLES = [...STAFF_ROLES, CUSTOMER_ROLE_ID];
const ROLE_NAMES = { 1: "Manager", 2: "Supervisor", 3: "Cashier", 4: "Service Staff" };

// Invite links live longer than the 30-min self-service reset link (that one
// guards an already-active session; this one is a one-time onboarding step),
// but still expire — an unused invite just gets recreated by the manager.
const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const listStaff = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role_id: { in: STAFF_ROLES } },
      include: {
        role: { select: { role_name: true } },
        staff: { select: { full_name: true, phone_no: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const staff = users.map(({ role, staff: s, ...u }) => ({
      ...u,
      role_name: role.role_name,
      full_name: s?.full_name ?? null,
      phone_no: s?.phone_no ?? null,
    }));

    res.status(200).json({ staff });
  } catch (error) {
    logger.error(`listStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getStaffMember = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { user_id: parseInt(req.params.id), role_id: { in: STAFF_ROLES } },
      include: {
        role: { select: { role_name: true } },
        staff: { select: { full_name: true, phone_no: true } },
      },
    });
    if (!user) return res.status(404).json({ message: "Staff member not found" });

    const { role, staff: s, ...rest } = user;
    res.status(200).json({
      staff: { ...rest, role_name: role.role_name, full_name: s?.full_name ?? null, phone_no: s?.phone_no ?? null },
    });
  } catch (error) {
    logger.error(`getStaffMember failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createStaff = async (req, res) => {
  const { email, full_name, role_id, phone_no } = req.body;

  if (!email || !full_name || !role_id)
    return res.status(400).json({ message: "email, full_name, and role_id are required" });
  if (!STAFF_ROLES.includes(parseInt(role_id)))
    return res.status(400).json({ message: "role_id must be 1 (Manager), 2 (Supervisor), 3 (Cashier), or 4 (Service Staff)" });

  // Email is treated as case-insensitive (same policy as auth.schema.js) — no Zod schema
  // guards this route, so it's normalized here instead.
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // The manager never chooses or sees a password — a random one is hashed
    // and thrown away immediately, and account_status stays "pending" (blocking
    // login) until the invite link below is used to set a real one.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const rawToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        const err = new Error("Email already registered"); err.status = 400; throw err;
      }

      return tx.user.create({
        data: {
          email: normalizedEmail,
          password_hash: placeholderHash,
          role_id: parseInt(role_id),
          account_status: "pending",
          reset_token_hash: hashResetToken(rawToken),
          reset_token_expires_at: new Date(Date.now() + SETUP_TOKEN_TTL_MS),
          staff: { create: { full_name: full_name.trim(), phone_no: phone_no || null } },
        },
        select: { user_id: true, email: true, role_id: true },
      });
    });

    const setupUrl = `${process.env.STAFF_FRONTEND_URL}/set-password?token=${rawToken}`;
    sendAccountSetupEmail(user.email, {
      fullName: full_name.trim(),
      roleName: ROLE_NAMES[user.role_id],
      setupUrl,
    });

    logger.info(`Staff account created (pending) — user_id: ${user.user_id}, role_id: ${role_id}`);
    res.status(201).json({ message: "Staff account created. An invite email has been sent.", user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`createStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteStaff = async (req, res) => {
  const { id } = req.params;

  // Deleting your own account while acting on it would lock you out with no
  // one left to undo it — same guard admin panels commonly apply.
  if (parseInt(id) === req.user.user_id)
    return res.status(400).json({ message: "You cannot delete your own account" });

  try {
    const existing = await prisma.user.findFirst({
      where: { user_id: parseInt(id), role_id: { in: STAFF_ROLES } },
      select: { user_id: true, account_status: true },
    });
    if (!existing) return res.status(404).json({ message: "Staff member not found" });

    // Safe to hard-delete regardless of status: ServiceRecord.supervisor_id,
    // ServiceStaffAssignment.staff_id, and Invoice.cashier_id all go null on
    // delete (not blocked), and each of those tables keeps a name snapshot
    // taken at the time the record was created — so past invoices, service
    // records, and job assignments keep reading correctly even though the
    // account and its login access are gone for good.
    await prisma.user.delete({ where: { user_id: parseInt(id) } });

    logger.info(`Staff account permanently deleted — user_id: ${id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "USER_DELETED", entity_type: "user", entity_id: parseInt(id) });
    res.status(200).json({ message: "Staff account permanently deleted" });
  } catch (error) {
    logger.error(`deleteStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { full_name, phone_no, email } = req.body;

  if (!full_name) return res.status(400).json({ message: "full_name is required" });

  try {
    await prisma.$transaction(async (tx) => {
      if (email) {
        await tx.user.update({ where: { user_id: parseInt(id) }, data: { email: email.trim().toLowerCase() } });
      }
      const existing = await tx.staff.findUnique({ where: { user_id: parseInt(id) } });
      if (!existing) {
        const err = new Error("Staff member not found"); err.status = 404; throw err;
      }
      await tx.staff.update({
        where: { user_id: parseInt(id) },
        data: { full_name: full_name.trim(), phone_no: phone_no || null },
      });
    });

    const updated = await prisma.staff.findUnique({ where: { user_id: parseInt(id) } });
    res.status(200).json({ message: "Staff updated", staff: updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`updateStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const setAccountStatus = async (req, res) => {
  const { id } = req.params;
  const { account_status } = req.body;

  if (!["active", "inactive"].includes(account_status))
    return res.status(400).json({ message: "account_status must be 'active' or 'inactive'" });

  try {
    const user = await prisma.user.updateMany({
      where: { user_id: parseInt(id), role_id: { in: MANAGEABLE_ROLES } },
      data: { account_status },
    });
    if (user.count === 0) return res.status(404).json({ message: "Account not found" });

    logger.info(`User ${id} status set to ${account_status}`);
    if (account_status === "inactive") {
      logActivity(prisma, { user_id: req.user.user_id, action: "USER_DEACTIVATED", entity_type: "user", entity_id: parseInt(id) });
    }
    const updated = await prisma.user.findUnique({
      where: { user_id: parseInt(id) },
      select: { user_id: true, email: true, account_status: true },
    });
    res.status(200).json({ message: "Account status updated", user: updated });
  } catch (error) {
    logger.error(`setAccountStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6)
    return res.status(400).json({ message: "new_password must be at least 6 characters" });

  try {
    const exists = await prisma.user.findFirst({
      where: { user_id: parseInt(id), role_id: { in: STAFF_ROLES } },
      select: { user_id: true },
    });
    if (!exists) return res.status(404).json({ message: "Staff member not found" });

    const hash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({ where: { user_id: parseInt(id) }, data: { password_hash: hash } });

    logger.info(`Password reset for user_id: ${id}`);
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    logger.error(`resetPassword failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listCustomers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role_id: CUSTOMER_ROLE_ID },
      include: { customer: { select: { full_name: true, phone: true, address: true } } },
      orderBy: { created_at: "desc" },
    });

    const customers = users.map(({ customer: c, ...u }) => ({
      ...u,
      full_name: c?.full_name ?? null,
      phone: c?.phone ?? null,
      address: c?.address ?? null,
    }));

    res.status(200).json({ customers });
  } catch (error) {
    logger.error(`listCustomers failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getCustomer = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { user_id: parseInt(req.params.id), role_id: CUSTOMER_ROLE_ID },
      include: {
        customer: true,
        vehicles: {
          select: {
            vehicle_id: true,
            plate_no: true,
            year: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
            custom_make: true,
            custom_model: true,
          },
          orderBy: { vehicle_id: "desc" },
        },
        reservations: {
          select: {
            reservation_id: true,
            booking_ref: true,
            service_date: true,
            status: true,
            package: { select: { name: true } },
          },
          orderBy: { service_date: "desc" },
          take: 5,
        },
      },
    });
    if (!user) return res.status(404).json({ message: "Customer not found" });

    const { customer: c, vehicles, reservations, ...rest } = user;
    res.status(200).json({
      customer: {
        ...rest,
        full_name: c?.full_name ?? null,
        phone: c?.phone ?? null,
        secondary_phone: c?.secondary_phone ?? null,
        address: c?.address ?? null,
        vehicles: vehicles.map((v) => ({
          vehicle_id: v.vehicle_id,
          plate_no: v.plate_no,
          year: v.year,
          make: v.make?.name ?? v.custom_make ?? null,
          model: v.model?.name ?? v.custom_model ?? null,
        })),
        recent_bookings: reservations.map((r) => ({
          reservation_id: r.reservation_id,
          booking_ref: r.booking_ref,
          service_date: r.service_date,
          status: r.status,
          package_name: r.package?.name ?? null,
        })),
      },
    });
  } catch (error) {
    logger.error(`getCustomer failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createCustomer = async (req, res) => {
  const { email, full_name, phone, secondary_phone, address } = req.body;

  if (!email || !full_name || !phone)
    return res.status(400).json({ message: "email, full_name, and phone are required" });
  if (!isValidSriLankanPhone(phone))
    return res.status(400).json({ message: "Enter a valid phone number, e.g. +94771234567" });
  if (secondary_phone && !isValidPhone(secondary_phone))
    return res.status(400).json({ message: "Enter a valid secondary phone number" });

  // Email is treated as case-insensitive (same policy as auth.schema.js) — no Zod schema
  // guards this route, so it's normalized here instead.
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Same pattern as createStaff — the manager never chooses or sees a password, and
    // account_status stays "pending" (blocking login) until the invite link is used.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const rawToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        const err = new Error("Email already registered"); err.status = 400; throw err;
      }

      return tx.user.create({
        data: {
          email: normalizedEmail,
          password_hash: placeholderHash,
          role_id: CUSTOMER_ROLE_ID,
          account_status: "pending",
          reset_token_hash: hashResetToken(rawToken),
          reset_token_expires_at: new Date(Date.now() + SETUP_TOKEN_TTL_MS),
          customer: {
            create: {
              full_name: full_name.trim(),
              phone: phone || null,
              secondary_phone: secondary_phone || null,
              address: address || null,
            },
          },
        },
        select: { user_id: true, email: true, role_id: true },
      });
    });

    // Customers set their password through the same /reset-password page a
    // self-service "forgot password" link points to — no separate customer setup page exists.
    const setupUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    sendCustomerAccountSetupEmail(user.email, { fullName: full_name.trim(), setupUrl });

    logger.info(`Customer account created (pending) — user_id: ${user.user_id}`);
    res.status(201).json({ message: "Customer account created. An invite email has been sent.", user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`createCustomer failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, secondary_phone, address, email } = req.body;

  if (!full_name || !phone)
    return res.status(400).json({ message: "full_name and phone are required" });
  if (!isValidSriLankanPhone(phone))
    return res.status(400).json({ message: "Enter a valid phone number, e.g. +94771234567" });
  if (secondary_phone && !isValidPhone(secondary_phone))
    return res.status(400).json({ message: "Enter a valid secondary phone number" });

  try {
    await prisma.$transaction(async (tx) => {
      if (email) {
        await tx.user.update({ where: { user_id: parseInt(id) }, data: { email: email.trim().toLowerCase() } });
      }
      const existing = await tx.customer.findUnique({ where: { user_id: parseInt(id) } });
      if (!existing) {
        const err = new Error("Customer not found"); err.status = 404; throw err;
      }
      await tx.customer.update({
        where: { user_id: parseInt(id) },
        data: {
          full_name: full_name.trim(),
          phone: phone || null,
          secondary_phone: secondary_phone || null,
          address: address || null,
        },
      });
    });

    const updated = await prisma.customer.findUnique({ where: { user_id: parseInt(id) } });
    res.status(200).json({ message: "Customer updated", customer: updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`updateCustomer failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listStaff, getStaffMember, createStaff, updateStaff, deleteStaff,
  setAccountStatus, resetPassword, listCustomers,
  getCustomer, createCustomer, updateCustomer,
};
