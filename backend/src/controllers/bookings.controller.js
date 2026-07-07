const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate, fmtTime } = require("../lib/format");
const { sendBookingConfirmation, sendBookingCancellation } = require("../services/email.service");

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
  make: r.vehicle?.make,
  model: r.vehicle?.model,
  plate_no: r.vehicle?.plate_no,
  color: r.vehicle?.color,
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
  vehicle: { select: { make: true, model: true, plate_no: true, color: true } },
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

  if (!vehicle_id || !package_id || !service_date)
    return res.status(400).json({ message: "vehicle_id, package_id, and service_date are required" });

  try {
    const { reservation_id, booking_ref, pkgName } = await prisma.$transaction(async (tx) => {
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

      const booked = await tx.reservation.count({
        where: { service_date: new Date(service_date), status: { notIn: ["Cancelled", "No-show"] } },
      });
      if (booked >= config.daily_capacity) {
        const err = new Error("No available slots for this date — daily capacity reached"); err.status = 400; throw err;
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
          slot_id: slot_id ? parseInt(slot_id) : null,
          service_date: new Date(service_date),
        },
      });

      const ref = `DW-${new Date(service_date).getFullYear()}-${String(reservation.reservation_id).padStart(5, "0")}`;
      await tx.reservation.update({
        where: { reservation_id: reservation.reservation_id },
        data: { booking_ref: ref },
      });

      return { reservation_id: reservation.reservation_id, booking_ref: ref, pkgName: pkg.name };
    });

    logger.info(`Booking created — ref: ${booking_ref}, user_id: ${user_id}`);

    // Email notification (outside transaction — non-critical)
    const customer = await prisma.user.findUnique({
      where: { user_id },
      select: { email: true, customer: { select: { full_name: true } } },
    });
    const slotRow = slot_id
      ? await prisma.timeSlot.findUnique({ where: { slot_id: parseInt(slot_id) } })
      : null;

    sendBookingConfirmation(customer.email, {
      customerName: customer.customer?.full_name,
      bookingRef: booking_ref,
      packageName: pkgName,
      serviceDate: service_date,
      slotTime: slotRow ? fmtTime(slotRow.slot_time) : "To be confirmed",
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

    const booked = await prisma.reservation.count({
      where: { service_date: new Date(date), status: { notIn: ["Cancelled", "No-show"] } },
    });

    if (booked >= config.daily_capacity)
      return res.status(200).json({ available: false, reason: "Daily capacity reached", slots: [] });

    const slots = await prisma.timeSlot.findMany({
      where: { is_active: true },
      orderBy: { slot_time: "asc" },
    });

    res.status(200).json({
      available: true,
      remaining_capacity: config.daily_capacity - booked,
      slots: slots.map((s) => ({ ...s, slot_time: fmtTime(s.slot_time) })),
    });
  } catch (error) {
    logger.error(`getAvailableSlots failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listBookings, getBooking, createBooking, cancelBooking, overrideStatus, getAvailableSlots };
