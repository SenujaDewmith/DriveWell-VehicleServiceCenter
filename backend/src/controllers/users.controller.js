const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

const STAFF_ROLES = [1, 2, 3, 4];

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
  const { email, password, full_name, role_id, phone_no } = req.body;

  if (!email || !password || !full_name || !role_id)
    return res.status(400).json({ message: "email, password, full_name, and role_id are required" });
  if (!STAFF_ROLES.includes(parseInt(role_id)))
    return res.status(400).json({ message: "role_id must be 1 (Manager), 2 (Supervisor), 3 (Cashier), or 4 (Service Staff)" });
  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        const err = new Error("Email already registered"); err.status = 400; throw err;
      }

      const hash = await bcrypt.hash(password, 10);
      return tx.user.create({
        data: {
          email,
          password_hash: hash,
          role_id: parseInt(role_id),
          staff: { create: { full_name: full_name.trim(), phone_no: phone_no || null } },
        },
        select: { user_id: true, email: true, role_id: true },
      });
    });

    logger.info(`Staff account created — user_id: ${user.user_id}, role_id: ${role_id}`);
    res.status(201).json({ message: "Staff account created", user });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`createStaff failed — ${error.message}`);
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
        await tx.user.update({ where: { user_id: parseInt(id) }, data: { email } });
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
      where: { user_id: parseInt(id), role_id: { in: STAFF_ROLES } },
      data: { account_status },
    });
    if (user.count === 0) return res.status(404).json({ message: "Staff member not found" });

    logger.info(`User ${id} status set to ${account_status}`);
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
      where: { role_id: 5 },
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

module.exports = { listStaff, getStaffMember, createStaff, updateStaff, setAccountStatus, resetPassword, listCustomers };
