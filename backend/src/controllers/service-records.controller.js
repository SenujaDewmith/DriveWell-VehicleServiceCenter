const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { sendStatusUpdate } = require("../services/email.service");
const { logActivity } = require("../lib/activityLogger");

const NOTIFY_STATUSES = ["Completed", "Ready for Pickup"];
const SERVICE_STAFF_ROLE = 4;

// Minimal staff picklist for the assignment dropdown — Supervisor doesn't have
// access to the full /api/users/staff (Manager-only) listing.
const listServiceStaffOptions = async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role_id: SERVICE_STAFF_ROLE, account_status: "active" },
      select: { user_id: true, staff: { select: { full_name: true } } },
    });
    res.status(200).json({
      staff: staff.map((s) => ({ user_id: s.user_id, full_name: s.staff?.full_name ?? null })),
    });
  } catch (error) {
    logger.error(`listServiceStaffOptions failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

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
        items: { include: { catalog_item: true }, orderBy: { created_at: "asc" } },
      },
    });
    if (!record) return res.status(404).json({ message: "Service record not found" });

    const flatRecord = {
      ...record,
      supervisor_name: record.supervisor?.staff?.full_name ?? null,
      supervisor: undefined,
      items: record.items.map((i) => ({
        item_id: i.item_id,
        record_id: i.record_id,
        catalog_item_id: i.catalog_item_id,
        catalog_item_name: i.catalog_item?.name ?? null,
        description: i.description,
        quantity: i.quantity,
      })),
    };

    const assignments = record.assignments
      .sort((a, b) => a.assignment_id - b.assignment_id)
      .map((a) => ({
        assignment_id: a.assignment_id,
        record_id: a.record_id,
        staff_id: a.staff_id,
        work_note: a.work_note,
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
  const { remarks } = req.body;

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
  const { remarks, quality_checked } = req.body;

  try {
    const record = await prisma.serviceRecord.update({
      where: { reservation_id: parseInt(booking_id) },
      data: {
        remarks: remarks || null,
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

// A service is assumed to involve at most 3 contributing staff members —
// matches the fixed 3-slot assignment UI on the Supervisor dashboard.
const MAX_STAFF_PER_RECORD = 3;

const assignStaff = async (req, res) => {
  const { booking_id } = req.params;
  const { staff_id, work_note } = req.body;

  if (!staff_id)
    return res.status(400).json({ message: "staff_id is required" });

  try {
    const record = await prisma.serviceRecord.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      select: { record_id: true },
    });
    if (!record) return res.status(404).json({ message: "Service record not found" });

    const existingCount = await prisma.serviceStaffAssignment.count({
      where: { record_id: record.record_id },
    });
    if (existingCount >= MAX_STAFF_PER_RECORD)
      return res.status(400).json({ message: `A service can have at most ${MAX_STAFF_PER_RECORD} staff contributors` });

    const assignment = await prisma.serviceStaffAssignment.create({
      data: { record_id: record.record_id, staff_id: parseInt(staff_id), work_note: work_note || null },
      include: { staff: { select: { staff: { select: { full_name: true } } } } },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "STAFF_ASSIGNED", entity_type: "service_record", entity_id: record.record_id });
    res.status(201).json({
      message: "Staff assigned",
      assignment: {
        assignment_id: assignment.assignment_id,
        record_id: assignment.record_id,
        staff_id: assignment.staff_id,
        work_note: assignment.work_note,
        staff_name: assignment.staff?.staff?.full_name ?? null,
      },
    });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "This staff member is already assigned to this service" });
    logger.error(`assignStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateAssignment = async (req, res) => {
  const { assignment_id } = req.params;
  const { staff_id, work_note } = req.body;

  try {
    const assignment = await prisma.serviceStaffAssignment.update({
      where: { assignment_id: parseInt(assignment_id) },
      data: {
        ...(staff_id !== undefined && { staff_id: parseInt(staff_id) }),
        ...(work_note !== undefined && { work_note: work_note || null }),
      },
      include: { staff: { select: { staff: { select: { full_name: true } } } } },
    });
    res.status(200).json({
      message: "Assignment updated",
      assignment: {
        assignment_id: assignment.assignment_id,
        record_id: assignment.record_id,
        staff_id: assignment.staff_id,
        work_note: assignment.work_note,
        staff_name: assignment.staff?.staff?.full_name ?? null,
      },
    });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Assignment not found" });
    if (error.code === "P2002")
      return res.status(400).json({ message: "This staff member is already assigned to this service" });
    logger.error(`updateAssignment failed — ${error.message}`);
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

// Supervisor documents additional work/parts found necessary during service —
// pick from the manager's charge catalog, or note something custom. No price:
// pricing is the cashier's call at invoice time.
const addServiceRecordItem = async (req, res) => {
  const { booking_id } = req.params;
  const { catalog_item_id, description, quantity } = req.body;

  if (!catalog_item_id && !description)
    return res.status(400).json({ message: "catalog_item_id or description is required" });

  try {
    const record = await prisma.serviceRecord.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      select: { record_id: true },
    });
    if (!record) return res.status(404).json({ message: "Service record not found" });

    let itemDescription = description;
    if (catalog_item_id && !itemDescription) {
      const catalogItem = await prisma.chargeCatalogItem.findUnique({
        where: { catalog_item_id: parseInt(catalog_item_id) },
        select: { name: true },
      });
      if (!catalogItem) return res.status(404).json({ message: "Charge catalog item not found" });
      itemDescription = catalogItem.name;
    }

    const item = await prisma.serviceRecordItem.create({
      data: {
        record_id: record.record_id,
        catalog_item_id: catalog_item_id ? parseInt(catalog_item_id) : null,
        description: itemDescription,
        quantity: quantity ? parseInt(quantity) : 1,
      },
      include: { catalog_item: true },
    });
    res.status(201).json({
      message: "Service item added",
      item: {
        item_id: item.item_id,
        record_id: item.record_id,
        catalog_item_id: item.catalog_item_id,
        catalog_item_name: item.catalog_item?.name ?? null,
        description: item.description,
        quantity: item.quantity,
      },
    });
  } catch (error) {
    logger.error(`addServiceRecordItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const removeServiceRecordItem = async (req, res) => {
  const { item_id } = req.params;
  try {
    await prisma.serviceRecordItem.delete({
      where: { item_id: parseInt(item_id) },
    });
    res.status(200).json({ message: "Service item removed" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Service item not found" });
    logger.error(`removeServiceRecordItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getServiceRecord, createServiceRecord, updateServiceRecord,
  updateStatus, assignStaff, updateAssignment, removeStaffAssignment,
  addServiceRecordItem, removeServiceRecordItem, listServiceStaffOptions,
};
