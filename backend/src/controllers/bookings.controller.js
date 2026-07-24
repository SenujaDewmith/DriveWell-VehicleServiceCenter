const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate, fmtTime } = require("../lib/format");
const { sendBookingConfirmation, sendBookingCancellation } = require("../services/email.service");
const { logActivity } = require("../lib/activityLogger");
const { VEHICLE_SELECT, flattenVehicleRef } = require("../lib/vehicleFlatten");
const {
  timeStrToMinutes, dateColToMinutes, minutesToTimeDate, minutesToHHMM,
  getBlockedRangesForDate, generateWindows, rangesOverlap,
  MIN_LEAD_MINUTES, getLocalNow,
} = require("../lib/slotGenerator");

const CUSTOMER_ROLE = 5;
const MANAGER_ROLE = 1;

// Customers may self-cancel only up to this many minutes before the appointment
// (staff/manager cancellations are exempt — this is a self-service guardrail, not a hard business rule)
const CANCELLATION_CUTOFF_MINUTES = 24 * 60;

// Must match TERMS_VERSION in customer_fd/src/lib/terms.ts — bump both together when the
// T&C text changes so bookings always record which wording the customer actually accepted.
const CURRENT_TERMS_VERSION = "1.0";

const flattenBooking = (r) => ({
  reservation_id: r.reservation_id,
  booking_ref: r.booking_ref,
  service_date: fmtDate(r.service_date),
  status: r.status,
  created_at: r.created_at,
  customer_id: r.customer_id,
  vehicle_id: r.vehicle_id,
  package_id: r.package_id,
  customer_name: r.customer_user?.customer?.full_name,
  customer_email: r.customer_user?.email,
  ...flattenVehicleRef(r.vehicle),
  package_name: r.package?.name,
  package_price: r.package?.price,
  estimated_duration: r.package?.estimated_duration,
  slot_time: fmtTime(r.start_time),
  slot_end_time: fmtTime(r.end_time),
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
};

// Richer include used only for the single-booking detail view — the list view stays
// lean since it doesn't need service-record/invoice data for every row.
const BOOKING_DETAIL_INCLUDE = {
  ...BOOKING_INCLUDE,
  service_record: {
    select: {
      remarks: true,
      quality_checked: true,
      has_oil_change: true,
      current_odometer: true,
      next_service_odometer: true,
      started_at: true,
      completed_at: true,
      items: { select: { description: true, quantity: true } },
    },
  },
  invoice: { include: { items: true } },
};

// `includeServiceItems` gates the supervisor's itemized "additional work found" notes out
// of the customer payload — same policy as invoices.controller.js's includeSupervisorNotes:
// remarks are customer-facing, but the structured item list stays internal/staff-only.
const flattenBookingDetail = (r, { includeServiceItems = false } = {}) => ({
  ...flattenBooking(r),
  service_record: r.service_record
    ? {
        remarks: r.service_record.remarks,
        quality_checked: r.service_record.quality_checked,
        // Same as invoices.controller.js: genuinely useful to the customer
        // (their next-service-due distance), so always included, unlike items.
        has_oil_change: r.service_record.has_oil_change,
        current_odometer: r.service_record.current_odometer,
        next_service_odometer: r.service_record.next_service_odometer,
        started_at: r.service_record.started_at,
        completed_at: r.service_record.completed_at,
        ...(includeServiceItems && {
          items: r.service_record.items.map((i) => ({ description: i.description, quantity: i.quantity })),
        }),
      }
    : null,
  invoice: r.invoice
    ? {
        invoice_id: r.invoice.invoice_id,
        base_amount: r.invoice.base_amount,
        additional_charges: r.invoice.additional_charges,
        discount: r.invoice.discount,
        total_amount: r.invoice.total_amount,
        payment_status: r.invoice.payment_status,
        payment_method: r.invoice.payment_method,
        notes: r.invoice.notes,
        generated_at: r.invoice.generated_at,
        items: r.invoice.items.map((it) => ({
          invoice_item_id: it.invoice_item_id,
          description: it.description,
          unit_price: it.unit_price,
          quantity: it.quantity,
          line_total: it.line_total,
        })),
      }
    : null,
});

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
      include: BOOKING_DETAIL_INCLUDE,
    });
    if (!row) return res.status(404).json({ message: "Booking not found" });
    if (role_id === CUSTOMER_ROLE && row.customer_id !== user_id)
      return res.status(403).json({ message: "Access denied" });

    res.status(200).json({
      booking: flattenBookingDetail(row, { includeServiceItems: role_id !== CUSTOMER_ROLE }),
    });
  } catch (error) {
    logger.error(`getBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createBooking = async (req, res) => {
  const { user_id } = req.user;
  const { vehicle_id, package_id, service_date, start_time, terms_accepted, terms_version } = req.body;

  if (!vehicle_id || !package_id || !service_date || !start_time)
    return res.status(400).json({ message: "vehicle_id, package_id, service_date, and start_time are required" });

  // Consent is enforced server-side (not just a disabled button in the UI) and the
  // accepted version is recorded on the reservation for later dispute resolution.
  if (terms_accepted !== true)
    return res.status(400).json({ message: "You must accept the Terms & Conditions to place a booking" });
  if (terms_version !== CURRENT_TERMS_VERSION)
    return res.status(400).json({ message: "Our Terms & Conditions have been updated — please review and accept the latest version" });

  try {
    const { reservation_id, booking_ref, pkgName, startStr, endStr } = await prisma.$transaction(async (tx) => {
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

      const pkg = await tx.servicePackage.findFirst({
        where: { package_id: parseInt(package_id), is_active: true },
      });
      if (!pkg) {
        const err = new Error("Service package not found or inactive"); err.status = 400; throw err;
      }

      const startMin = timeStrToMinutes(start_time);
      const endMin = startMin + pkg.estimated_duration;
      const dayStartMin = dateColToMinutes(config.day_start_time);
      const dayEndMin = dateColToMinutes(config.day_end_time);
      if (startMin < dayStartMin || endMin > dayEndMin) {
        const err = new Error("Selected time does not fit within business hours for this service"); err.status = 400; throw err;
      }

      const { todayKey, nowMinutes } = getLocalNow();
      if (service_date < todayKey) {
        const err = new Error("Cannot book a date in the past"); err.status = 400; throw err;
      }
      if (service_date === todayKey) {
        const cutoffStart = dayEndMin - config.same_day_cutoff_minutes;
        if (nowMinutes >= cutoffStart) {
          const err = new Error(`Same-day bookings close at ${minutesToHHMM(cutoffStart)} — please choose another date`); err.status = 400; throw err;
        }
        if (startMin < nowMinutes + MIN_LEAD_MINUTES) {
          const err = new Error(`Bookings require at least ${MIN_LEAD_MINUTES} minutes advance notice`); err.status = 400; throw err;
        }
      }

      const blocked = await getBlockedRangesForDate(tx, service_date);
      if (blocked.some((b) => rangesOverlap(startMin, endMin, b.start, b.end))) {
        const err = new Error("Selected time overlaps a blocked/unavailable period"); err.status = 400; throw err;
      }

      const existing = await tx.reservation.findMany({
        where: {
          service_date: new Date(service_date),
          package_id: parseInt(package_id),
          status: { notIn: ["Cancelled", "No-show"] },
        },
        select: { start_time: true, end_time: true },
      });
      const overlapCount = existing.filter((r) =>
        rangesOverlap(startMin, endMin, dateColToMinutes(r.start_time), dateColToMinutes(r.end_time)),
      ).length;
      if (overlapCount >= pkg.max_capacity) {
        const err = new Error("This time is fully booked for the selected package — please choose another time"); err.status = 400; throw err;
      }

      const reservation = await tx.reservation.create({
        data: {
          customer_id: user_id,
          vehicle_id: parseInt(vehicle_id),
          package_id: parseInt(package_id),
          start_time: minutesToTimeDate(startMin),
          end_time: minutesToTimeDate(endMin),
          service_date: new Date(service_date),
          terms_version,
          terms_accepted_at: new Date(),
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
        startStr: minutesToHHMM(startMin),
        endStr: minutesToHHMM(endMin),
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
      slotTime: `${startStr} - ${endStr}`,
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

    if (role_id === CUSTOMER_ROLE) {
      const { todayKey, nowMinutes } = getLocalNow();
      const daysUntil = Math.round((new Date(fmtDate(booking.service_date)) - new Date(todayKey)) / 86400000);
      const minutesUntil = daysUntil * 1440 + (dateColToMinutes(booking.start_time) - nowMinutes);
      if (minutesUntil < CANCELLATION_CUTOFF_MINUTES) {
        return res.status(400).json({
          message: "Cancellations must be made at least 24 hours before the scheduled appointment. Please contact us directly for urgent changes.",
        });
      }
    }

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

// Package-aware appointment windows for a given date: business hours are chunked
// into back-to-back windows sized to the package's own duration, with each window's
// capacity coming from the package's max_capacity (concurrent bookings of that package).
const getAvailableSlots = async (req, res) => {
  const { date, package_id } = req.query;
  if (!date || !package_id)
    return res.status(400).json({ message: "date and package_id query params are required" });

  try {
    const config = await prisma.workingConfig.findFirst();
    const dayOfWeek = new Date(date).getDay();
    const workingDays = config.working_days.split(",").map(Number);

    if (!workingDays.includes(dayOfWeek))
      return res.status(200).json({ available: false, reason: "Not a working day", slots: [] });

    const { todayKey, nowMinutes } = getLocalNow();
    if (date < todayKey)
      return res.status(200).json({ available: false, reason: "This date has already passed", slots: [] });

    const dayStartMin = dateColToMinutes(config.day_start_time);
    const dayEndMin = dateColToMinutes(config.day_end_time);

    if (date === todayKey) {
      const cutoffStart = dayEndMin - config.same_day_cutoff_minutes;
      if (nowMinutes >= cutoffStart) {
        return res.status(200).json({
          available: false,
          reason: `Same-day bookings close at ${minutesToHHMM(cutoffStart)} — please choose another date`,
          slots: [],
        });
      }
    }

    const pkg = await prisma.servicePackage.findFirst({
      where: { package_id: parseInt(package_id), is_active: true },
    });
    if (!pkg) return res.status(404).json({ message: "Service package not found" });

    const blocked = await getBlockedRangesForDate(prisma, date);
    let rawWindows = generateWindows(dayStartMin, dayEndMin, pkg.estimated_duration, blocked);
    if (date === todayKey) {
      const minStart = nowMinutes + MIN_LEAD_MINUTES;
      rawWindows = rawWindows.filter((w) => w.start >= minStart);
    }

    const existing = await prisma.reservation.findMany({
      where: {
        service_date: new Date(date),
        package_id: parseInt(package_id),
        status: { notIn: ["Cancelled", "No-show"] },
      },
      select: { start_time: true, end_time: true },
    });
    const existingRanges = existing.map((r) => ({
      start: dateColToMinutes(r.start_time),
      end: dateColToMinutes(r.end_time),
    }));

    const slots = rawWindows.map((w) => {
      const booked_count = existingRanges.filter((r) => rangesOverlap(w.start, w.end, r.start, r.end)).length;
      return {
        start_time: minutesToHHMM(w.start),
        end_time: minutesToHHMM(w.end),
        capacity: pkg.max_capacity,
        booked_count,
        remaining: Math.max(pkg.max_capacity - booked_count, 0),
      };
    });

    const available = slots.some((s) => s.remaining > 0);
    const fullDayBlock = blocked.find((b) => b.start <= dayStartMin && b.end >= dayEndMin);

    res.status(200).json({
      available,
      ...(available
        ? {}
        : {
            reason: fullDayBlock
              ? fullDayBlock.reason || "This date is closed"
              : slots.length === 0
                ? date === todayKey
                  ? "No more appointments can be booked today"
                  : "This service does not fit in business hours on this date"
                : "All appointment windows are fully booked",
          }),
      slots,
    });
  } catch (error) {
    logger.error(`getAvailableSlots failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// Day-level availability status for every day in a given month, for the booking calendar view.
// Computed per-package: how many of that package's auto-generated windows are still bookable.
const getMonthAvailability = async (req, res) => {
  const { year, month, package_id } = req.query; // month is 1-12
  if (!year || !month || !package_id)
    return res.status(400).json({ message: "year, month, and package_id query params are required" });

  try {
    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0));

    const pkg = await prisma.servicePackage.findFirst({
      where: { package_id: parseInt(package_id), is_active: true },
    });
    if (!pkg) return res.status(404).json({ message: "Service package not found" });

    const config = await prisma.workingConfig.findFirst();
    const workingDays = config.working_days.split(",").map(Number);
    const dayStartMin = dateColToMinutes(config.day_start_time);
    const dayEndMin = dateColToMinutes(config.day_end_time);

    const recurringBlocked = await prisma.blockedTime.findMany({ where: { date: null } });
    const recurringRanges = recurringBlocked.map((b) => ({
      start: dateColToMinutes(b.start_time),
      end: dateColToMinutes(b.end_time),
    }));

    const oneOffBlocked = await prisma.blockedTime.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const oneOffByDate = {};
    oneOffBlocked.forEach((b) => {
      const key = b.date.toISOString().split("T")[0];
      if (!oneOffByDate[key]) oneOffByDate[key] = [];
      oneOffByDate[key].push({ start: dateColToMinutes(b.start_time), end: dateColToMinutes(b.end_time) });
    });

    const reservations = await prisma.reservation.findMany({
      where: {
        service_date: { gte: startDate, lte: endDate },
        package_id: parseInt(package_id),
        status: { notIn: ["Cancelled", "No-show"] },
      },
      select: { service_date: true, start_time: true, end_time: true },
    });
    const reservationsByDate = {};
    reservations.forEach((r) => {
      const key = r.service_date.toISOString().split("T")[0];
      if (!reservationsByDate[key]) reservationsByDate[key] = [];
      reservationsByDate[key].push({ start: dateColToMinutes(r.start_time), end: dateColToMinutes(r.end_time) });
    });

    const { todayKey, nowMinutes } = getLocalNow();
    const daysInMonth = endDate.getUTCDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(y, m - 1, d));
      const key = date.toISOString().split("T")[0];
      const isWorkingDay = workingDays.includes(date.getUTCDay());

      if (key < todayKey || !isWorkingDay) {
        days.push({ date: key, status: "closed", remaining_capacity: 0, total_windows: 0 });
        continue;
      }

      if (key === todayKey && nowMinutes >= dayEndMin - config.same_day_cutoff_minutes) {
        days.push({ date: key, status: "closed", remaining_capacity: 0, total_windows: 0 });
        continue;
      }

      const blockedForDay = [...recurringRanges, ...(oneOffByDate[key] || [])];
      let windows = generateWindows(dayStartMin, dayEndMin, pkg.estimated_duration, blockedForDay);
      if (key === todayKey) {
        const minStart = nowMinutes + MIN_LEAD_MINUTES;
        windows = windows.filter((w) => w.start >= minStart);
      }

      if (windows.length === 0) {
        days.push({ date: key, status: "closed", remaining_capacity: 0, total_windows: 0 });
        continue;
      }

      const dayReservations = reservationsByDate[key] || [];
      let remainingWindowCount = 0;
      for (const w of windows) {
        const overlapCount = dayReservations.filter((r) => rangesOverlap(w.start, w.end, r.start, r.end)).length;
        if (overlapCount < pkg.max_capacity) remainingWindowCount++;
      }

      const limitedThreshold = Math.max(1, Math.ceil(windows.length * 0.3));
      const status = remainingWindowCount <= 0 ? "full" : remainingWindowCount <= limitedThreshold ? "limited" : "available";
      days.push({ date: key, status, remaining_capacity: remainingWindowCount, total_windows: windows.length });
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
