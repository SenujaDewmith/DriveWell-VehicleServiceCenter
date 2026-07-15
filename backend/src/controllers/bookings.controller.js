const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate, fmtTime } = require("../lib/format");
const { sendBookingConfirmation, sendBookingCancellation } = require("../services/email.service");
const { logActivity } = require("../lib/activityLogger");
const { VEHICLE_SELECT, flattenVehicleRef } = require("../lib/vehicleFlatten");

const CUSTOMER_ROLE = 5;
const MANAGER_ROLE = 1;

const flattenBooking = (r) => ({
  reservation_id: r.reservation_id,
  booking_ref: r.booking_ref,
  service_date: fmtDate(r.service_date),
  status: r.status,
  created_at: r.created_at,
  customer_id: r.customer_id,
  vehicle_id: r.vehicle_id,
  package_id: r.package_id,
  slot_id: r.slot_id,
  customer_name: r.customer_user?.customer?.full_name,
  customer_email: r.customer_user?.email,
  ...flattenVehicleRef(r.vehicle),
  package_name: r.package?.name,
  package_price: r.package?.price,
  estimated_duration: r.package?.estimated_duration,
  slot_time: r.slot ? fmtTime(r.slot.slot_time) : null,
});

const BOOKING_INCLUDE = {
  customer_user: {
    select: {
      email: true,
      customer: { select: { full_name: true } },
    },
  },
  vehicle: VEHICLE_SELECT,
  package: { select: { name: true, price: true, estimated_duration: true } },
  slot: { select: { slot_time: true } },
};

const listBookings = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { status, from, to, customer_id, package_id } = req.query;

  try {
    const where = {};
    if (role_id === CUSTOMER_ROLE) where.customer_id = user_id;
    else if (customer_id) where.customer_id = parseInt(customer_id);
    if (status) where.status = status;
    if (from || to) {
      where.service_date = {};
      if (from) where.service_date.gte = new Date(from);
      if (to) where.service_date.lte = new Date(to);
    }
    if (package_id) where.package_id = parseInt(package_id);

    const rows = await prisma.reservation.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: [{ service_date: "desc" }, { created_at: "desc" }],
    });

    res.status(200).json({ bookings: rows.map(flattenBooking) });
  } catch (error) {
    logger.error(`listBookings failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getBooking = async (req, res) => {
  const { user_id, role_id } = req.user;
  try {
    const row = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(req.params.id) },
      include: BOOKING_INCLUDE,
    });
    if (!row) return res.status(404).json({ message: "Booking not found" });
    if (role_id === CUSTOMER_ROLE && row.customer_id !== user_id)
      return res.status(403).json({ message: "Access denied" });

    res.status(200).json({ booking: flattenBooking(row) });
  } catch (error) {
    logger.error(`getBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createBooking = async (req, res) => {
  const { user_id } = req.user;
  const { vehicle_id, package_id, slot_id, service_date } = req.body;

  if (!vehicle_id || !package_id || !service_date || !slot_id)
    return res.status(400).json({ message: "vehicle_id, package_id, slot_id, and service_date are required" });

  try {
    const { reservation_id, booking_ref, pkgName, slotTimeStr } = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { vehicle_id: parseInt(vehicle_id), customer_id: user_id },
      });
      if (!vehicle) {
        const err = new Error("Vehicle not found"); err.status = 400; throw err;
      }

      const config = await tx.workingConfig.findFirst();
      const dayOfWeek = new Date(service_date).getDay();
      const workingDays = config.working_days.split(",").map(Number);
      if (!workingDays.includes(dayOfWeek)) {
        const err = new Error("Selected date is not a working day"); err.status = 400; throw err;
      }

      const slot = await tx.timeSlot.findFirst({
        where: { slot_id: parseInt(slot_id), is_active: true },
      });
      if (!slot) {
        const err = new Error("Selected time slot is not available"); err.status = 400; throw err;
      }

      const slotBooked = await tx.reservation.count({
        where: {
          service_date: new Date(service_date),
          slot_id: parseInt(slot_id),
          status: { notIn: ["Cancelled", "No-show"] },
        },
      });
      if (slotBooked >= slot.capacity) {
        const err = new Error("This time slot is fully booked — please choose another time"); err.status = 400; throw err;
      }

      const pkg = await tx.servicePackage.findFirst({
        where: { package_id: parseInt(package_id), is_active: true },
      });
      if (!pkg) {
        const err = new Error("Service package not found or inactive"); err.status = 400; throw err;
      }

      const reservation = await tx.reservation.create({
        data: {
          customer_id: user_id,
          vehicle_id: parseInt(vehicle_id),
          package_id: parseInt(package_id),
          slot_id: parseInt(slot_id),
          service_date: new Date(service_date),
        },
      });

      const ref = `DW-${new Date(service_date).getFullYear()}-${String(reservation.reservation_id).padStart(5, "0")}`;
      await tx.reservation.update({
        where: { reservation_id: reservation.reservation_id },
        data: { booking_ref: ref },
      });

      return {
        reservation_id: reservation.reservation_id,
        booking_ref: ref,
        pkgName: pkg.name,
        slotTimeStr: fmtTime(slot.slot_time),
      };
    });

    logger.info(`Booking created — ref: ${booking_ref}, user_id: ${user_id}`);
    logActivity(prisma, { user_id, action: "BOOKING_CREATED", entity_type: "reservation", entity_id: reservation_id });

    // Email notification (outside transaction — non-critical)
    const customer = await prisma.user.findUnique({
      where: { user_id },
      select: { email: true, customer: { select: { full_name: true } } },
    });

    sendBookingConfirmation(customer.email, {
      customerName: customer.customer?.full_name,
      bookingRef: booking_ref,
      packageName: pkgName,
      serviceDate: service_date,
      slotTime: slotTimeStr,
    });

    res.status(201).json({ message: "Booking created", booking_ref, reservation_id });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`createBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const cancelBooking = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { id } = req.params;

  try {
    const booking = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(id) },
      include: {
        customer_user: {
          select: { email: true, customer: { select: { full_name: true } } },
        },
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (role_id === CUSTOMER_ROLE && booking.customer_id !== user_id)
      return res.status(403).json({ message: "Access denied" });
    if (booking.status !== "Booked")
      return res.status(400).json({ message: `Cannot cancel a booking with status: ${booking.status}` });

    await prisma.reservation.update({
      where: { reservation_id: parseInt(id) },
      data: { status: "Cancelled" },
    });

    sendBookingCancellation(booking.customer_user.email, {
      customerName: booking.customer_user.customer?.full_name,
      bookingRef: booking.booking_ref,
      serviceDate: fmtDate(booking.service_date),
    });

    logger.info(`Booking cancelled — reservation_id: ${id}`);
    logActivity(prisma, { user_id, action: "STATUS_CHANGED", entity_type: "reservation", entity_id: parseInt(id) });
    res.status(200).json({ message: "Booking cancelled" });
  } catch (error) {
    logger.error(`cancelBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const overrideStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup", "Cancelled", "No-show"];

  if (!status || !valid.includes(status))
    return res.status(400).json({ message: `status must be one of: ${valid.join(", ")}` });

  try {
    const booking = await prisma.reservation.update({
      where: { reservation_id: parseInt(id) },
      data: { status },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "STATUS_CHANGED", entity_type: "reservation", entity_id: parseInt(id) });
    res.status(200).json({ message: "Status updated", booking });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Booking not found" });
    logger.error(`overrideStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getAvailableSlots = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query param is required (YYYY-MM-DD)" });

  try {
    const config = await prisma.workingConfig.findFirst();
    const dayOfWeek = new Date(date).getDay();
    const workingDays = config.working_days.split(",").map(Number);

    if (!workingDays.includes(dayOfWeek))
      return res.status(200).json({ available: false, reason: "Not a working day", slots: [] });

    const slots = await prisma.timeSlot.findMany({
      where: { is_active: true },
      orderBy: { slot_time: "asc" },
    });

    const slotBookings = await prisma.reservation.groupBy({
      by: ["slot_id"],
      where: {
        service_date: new Date(date),
        status: { notIn: ["Cancelled", "No-show"] },
      },
      _count: { reservation_id: true },
    });
    const bookedBySlot = {};
    slotBookings.forEach((s) => { bookedBySlot[s.slot_id] = s._count.reservation_id; });

    const slotsWithAvailability = slots.map((s) => {
      const booked_count = bookedBySlot[s.slot_id] || 0;
      return {
        slot_id: s.slot_id,
        slot_time: fmtTime(s.slot_time),
        is_active: s.is_active,
        capacity: s.capacity,
        booked_count,
        remaining: Math.max(s.capacity - booked_count, 0),
      };
    });

    const available = slotsWithAvailability.some((s) => s.remaining > 0);

    res.status(200).json({
      available,
      ...(available ? {} : { reason: "All time slots are fully booked" }),
      slots: slotsWithAvailability,
    });
  } catch (error) {
    logger.error(`getAvailableSlots failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// Day-level availability status for every day in a given month, for the booking calendar view.
// Aggregated from each active time slot's own capacity (per-slot, admin-configurable).
const getMonthAvailability = async (req, res) => {
  const { year, month } = req.query; // month is 1-12
  if (!year || !month) return res.status(400).json({ message: "year and month query params are required" });

  try {
    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0));

    const config = await prisma.workingConfig.findFirst();
    const workingDays = config.working_days.split(",").map(Number);

    const activeSlots = await prisma.timeSlot.findMany({ where: { is_active: true } });
    const totalCapacity = activeSlots.reduce((sum, s) => sum + s.capacity, 0);

    const counts = await prisma.reservation.groupBy({
      by: ["service_date", "slot_id"],
      where: {
        service_date: { gte: startDate, lte: endDate },
        status: { notIn: ["Cancelled", "No-show"] },
      },
      _count: { reservation_id: true },
    });
    const countMap = {}; // countMap[dateKey][slot_id] = booked count
    counts.forEach((c) => {
      const key = c.service_date.toISOString().split("T")[0];
      if (!countMap[key]) countMap[key] = {};
      countMap[key][c.slot_id] = c._count.reservation_id;
    });

    const limitedThreshold = Math.max(1, Math.ceil(totalCapacity * 0.3));
    const daysInMonth = endDate.getUTCDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(y, m - 1, d));
      const key = date.toISOString().split("T")[0];
      const isWorkingDay = workingDays.includes(date.getUTCDay());

      if (!isWorkingDay || totalCapacity === 0) {
        days.push({ date: key, status: "closed", remaining_capacity: 0, daily_capacity: totalCapacity });
        continue;
      }

      const dayCounts = countMap[key] || {};
      let remaining_capacity = 0;
      for (const slot of activeSlots) {
        remaining_capacity += Math.max(slot.capacity - (dayCounts[slot.slot_id] || 0), 0);
      }

      const status = remaining_capacity <= 0 ? "full" : remaining_capacity <= limitedThreshold ? "limited" : "available";
      days.push({ date: key, status, remaining_capacity, daily_capacity: totalCapacity });
    }

    res.status(200).json({ days });
  } catch (error) {
    logger.error(`getMonthAvailability failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listBookings, getBooking, createBooking, cancelBooking, overrideStatus,
  getAvailableSlots, getMonthAvailability,
};
