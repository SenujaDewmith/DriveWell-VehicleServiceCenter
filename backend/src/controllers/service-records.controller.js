const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { sendStatusUpdate } = require("../services/email.service");
const { logActivity } = require("../lib/activityLogger");

const NOTIFY_STATUSES = ["Completed", "Ready for Pickup"];

const getServiceRecord = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const record = await prisma.serviceRecord.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      include: {
        supervisor: { select: { staff: { select: { full_name: true } } } },
        assignments: {
          include: { staff: { select: { staff: { select: { full_name: true } } } } },
        },
      },
    });
    if (!record) return res.status(404).json({ message: "Service record not found" });

    const flatRecord = {
      ...record,
      supervisor_name: record.supervisor?.staff?.full_name ?? null,
      supervisor: undefined,
    };

    const assignments = record.assignments.map((a) => ({
      assignment_id: a.assignment_id,
      record_id: a.record_id,
      staff_id: a.staff_id,
      task_type: a.task_type,
      staff_name: a.staff?.staff?.full_name ?? null,
    }));

    res.status(200).json({ record: flatRecord, assignments });
  } catch (error) {
    logger.error(`getServiceRecord failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createServiceRecord = async (req, res) => {
  const { user_id } = req.user;
  const { booking_id } = req.params;
  const { remarks, additional_work, consumables, additional_charges } = req.body;

  try {
    const record = await prisma.$transaction(async (tx) => {
      const booking = await tx.reservation.findUnique({
        where: { reservation_id: parseInt(booking_id) },
        select: { status: true },
      });
      if (!booking) {
        const err = new Error("Booking not found"); err.status = 404; throw err;
      }
      if (!["Booked", "Started"].includes(booking.status)) {
        const err = new Error("Booking is not in a state that can be started"); err.status = 400; throw err;
      }

      const existing = await tx.serviceRecord.findUnique({
        where: { reservation_id: parseInt(booking_id) },
      });
      if (existing) {
        const err = new Error("Service record already exists for this booking"); err.status = 400; throw err;
      }

      const created = await tx.serviceRecord.create({
        data: {
          reservation_id: parseInt(booking_id),
          supervisor_id: user_id,
          remarks: remarks || null,
          additional_work: additional_work || null,
          consumables: consumables || null,
          additional_charges: additional_charges || 0,
          started_at: new Date(),
        },
      });

      await tx.reservation.update({
        where: { reservation_id: parseInt(booking_id) },
        data: { status: "Started" },
      });

      return created;
    });

    logger.info(`Service record created — record_id: ${record.record_id}`);
    res.status(201).json({ message: "Service record created", record });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`createServiceRecord failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateServiceRecord = async (req, res) => {
  const { booking_id } = req.params;
  const { remarks, additional_work, consumables, additional_charges, quality_checked } = req.body;

  try {
    const record = await prisma.serviceRecord.update({
      where: { reservation_id: parseInt(booking_id) },
      data: {
        remarks: remarks || null,
        additional_work: additional_work || null,
        consumables: consumables || null,
        additional_charges: additional_charges ?? 0,
        quality_checked: quality_checked ?? false,
      },
    });
    if (quality_checked) {
      logActivity(prisma, { user_id: req.user.user_id, action: "QUALITY_CHECK", entity_type: "service_record", entity_id: record.record_id });
    }
    res.status(200).json({ message: "Service record updated", record });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Service record not found" });
    logger.error(`updateServiceRecord failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateStatus = async (req, res) => {
  const { booking_id } = req.params;
  const { status } = req.body;
  const valid = ["Started", "In Progress", "Completed", "Ready for Pickup"];

  if (!status || !valid.includes(status))
    return res.status(400).json({ message: `status must be one of: ${valid.join(", ")}` });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      if (status === "Completed") {
        await tx.serviceRecord.updateMany({
          where: { reservation_id: parseInt(booking_id) },
          data: { completed_at: new Date() },
        });
      }

      const updated = await tx.reservation.update({
        where: { reservation_id: parseInt(booking_id) },
        data: { status },
        select: { reservation_id: true, booking_ref: true, customer_id: true },
      });

      return updated;
    });

    if (NOTIFY_STATUSES.includes(status)) {
      const customer = await prisma.user.findUnique({
        where: { user_id: booking.customer_id },
        select: { email: true, customer: { select: { full_name: true } } },
      });
      sendStatusUpdate(customer.email, {
        customerName: customer.customer?.full_name,
        bookingRef: booking.booking_ref,
        status,
      });
    }

    logger.info(`Service status updated to '${status}' for reservation_id: ${booking_id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "STATUS_CHANGED", entity_type: "reservation", entity_id: parseInt(booking_id) });
    res.status(200).json({ message: "Status updated", status });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Booking not found" });
    logger.error(`updateStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const assignStaff = async (req, res) => {
  const { booking_id } = req.params;
  const { staff_id, task_type } = req.body;

  if (!staff_id || !task_type)
    return res.status(400).json({ message: "staff_id and task_type are required" });

  try {
    const record = await prisma.serviceRecord.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      select: { record_id: true },
    });
    if (!record) return res.status(404).json({ message: "Service record not found" });

    const assignment = await prisma.serviceStaffAssignment.create({
      data: { record_id: record.record_id, staff_id: parseInt(staff_id), task_type },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "STAFF_ASSIGNED", entity_type: "service_record", entity_id: record.record_id });
    res.status(201).json({ message: "Staff assigned", assignment });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(200).json({ message: "Staff already assigned", assignment: null });
    logger.error(`assignStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const removeStaffAssignment = async (req, res) => {
  const { assignment_id } = req.params;
  try {
    await prisma.serviceStaffAssignment.delete({
      where: { assignment_id: parseInt(assignment_id) },
    });
    res.status(200).json({ message: "Staff assignment removed" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Assignment not found" });
    logger.error(`removeStaffAssignment failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getServiceRecord, createServiceRecord, updateServiceRecord,
  updateStatus, assignStaff, removeStaffAssignment,
};
