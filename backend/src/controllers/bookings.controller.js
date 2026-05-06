const pool = require("../config/db");
const logger = require("../utils/logger");
const { sendBookingConfirmation, sendBookingCancellation } = require("../services/email.service");

const CUSTOMER_ROLE = 5;
const MANAGER_ROLE = 1;

// Base query to get enriched booking details
const BOOKING_QUERY = `
  SELECT
    r.reservation_id, r.booking_ref, r.service_date, r.status, r.created_at,
    r.customer_id, r.vehicle_id, r.package_id, r.slot_id,
    c.full_name AS customer_name,
    u.email    AS customer_email,
    v.make, v.model, v.plate_no, v.color,
    p.name AS package_name, p.price AS package_price, p.estimated_duration,
    ts.slot_time
  FROM reservations r
  JOIN customers c     ON c.user_id = r.customer_id
  JOIN users u         ON u.user_id = r.customer_id
  JOIN vehicles v      ON v.vehicle_id = r.vehicle_id
  JOIN service_packages p ON p.package_id = r.package_id
  LEFT JOIN time_slots ts ON ts.slot_id = r.slot_id
`;

const listBookings = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { status, from, to, customer_id, package_id } = req.query;

  try {
    let conditions = [];
    let values = [];
    let i = 1;

    if (role_id === CUSTOMER_ROLE) {
      conditions.push(`r.customer_id = $${i++}`);
      values.push(user_id);
    } else if (customer_id) {
      conditions.push(`r.customer_id = $${i++}`);
      values.push(customer_id);
    }

    if (status) { conditions.push(`r.status = $${i++}`); values.push(status); }
    if (from)   { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)     { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    if (package_id) { conditions.push(`r.package_id = $${i++}`); values.push(package_id); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`${BOOKING_QUERY} ${where} ORDER BY r.service_date DESC, r.created_at DESC`, values);
    res.status(200).json({ bookings: result.rows });
  } catch (error) {
    logger.error(`listBookings failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getBooking = async (req, res) => {
  const { user_id, role_id } = req.user;
  try {
    const result = await pool.query(`${BOOKING_QUERY} WHERE r.reservation_id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Booking not found" });

    const booking = result.rows[0];
    if (role_id === CUSTOMER_ROLE && booking.customer_id !== user_id)
      return res.status(403).json({ message: "Access denied" });

    res.status(200).json({ booking });
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify vehicle belongs to customer
    const vehicleCheck = await client.query(
      `SELECT vehicle_id FROM vehicles WHERE vehicle_id=$1 AND customer_id=$2`,
      [vehicle_id, user_id]
    );
    if (vehicleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Vehicle not found" });
    }

    // Check working config
    const configResult = await client.query(`SELECT * FROM working_config LIMIT 1`);
    const config = configResult.rows[0];
    const dayOfWeek = new Date(service_date).getDay();
    const workingDays = config.working_days.split(",").map(Number);

    if (!workingDays.includes(dayOfWeek)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected date is not a working day" });
    }

    // Check daily capacity
    const countResult = await client.query(
      `SELECT COUNT(*) FROM reservations WHERE service_date=$1 AND status NOT IN ('Cancelled','No-show')`,
      [service_date]
    );
    if (parseInt(countResult.rows[0].count) >= config.daily_capacity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No available slots for this date — daily capacity reached" });
    }

    // Check package is active
    const pkgResult = await client.query(
      `SELECT package_id, name, price FROM service_packages WHERE package_id=$1 AND is_active=TRUE`,
      [package_id]
    );
    if (pkgResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Service package not found or inactive" });
    }

    // Create reservation
    const insertResult = await client.query(
      `INSERT INTO reservations (customer_id, vehicle_id, package_id, slot_id, service_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING reservation_id`,
      [user_id, vehicle_id, package_id, slot_id || null, service_date]
    );
    const reservation_id = insertResult.rows[0].reservation_id;

    // Set booking_ref
    const booking_ref = `DW-${new Date(service_date).getFullYear()}-${String(reservation_id).padStart(5, "0")}`;
    await client.query(`UPDATE reservations SET booking_ref=$1 WHERE reservation_id=$2`, [booking_ref, reservation_id]);

    await client.query("COMMIT");
    logger.info(`Booking created — ref: ${booking_ref}, user_id: ${user_id}`);

    // Fetch customer email and slot time for notification
    const customerResult = await pool.query(
      `SELECT u.email, c.full_name, ts.slot_time
       FROM users u JOIN customers c ON c.user_id=u.user_id
       LEFT JOIN time_slots ts ON ts.slot_id=$1
       WHERE u.user_id=$2`,
      [slot_id || null, user_id]
    );
    const { email, full_name, slot_time } = customerResult.rows[0];

    sendBookingConfirmation(email, {
      customerName: full_name,
      bookingRef: booking_ref,
      packageName: pkgResult.rows[0].name,
      serviceDate: service_date,
      slotTime: slot_time || "To be confirmed",
    });

    res.status(201).json({ message: "Booking created", booking_ref, reservation_id });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`createBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const cancelBooking = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { id } = req.params;

  try {
    const bookingResult = await pool.query(
      `SELECT r.*, u.email, c.full_name
       FROM reservations r
       JOIN users u ON u.user_id=r.customer_id
       JOIN customers c ON c.user_id=r.customer_id
       WHERE r.reservation_id=$1`,
      [id]
    );
    if (bookingResult.rows.length === 0)
      return res.status(404).json({ message: "Booking not found" });

    const booking = bookingResult.rows[0];

    if (role_id === CUSTOMER_ROLE && booking.customer_id !== user_id)
      return res.status(403).json({ message: "Access denied" });

    if (!["Booked"].includes(booking.status))
      return res.status(400).json({ message: `Cannot cancel a booking with status: ${booking.status}` });

    await pool.query(`UPDATE reservations SET status='Cancelled' WHERE reservation_id=$1`, [id]);

    sendBookingCancellation(booking.email, {
      customerName: booking.full_name,
      bookingRef: booking.booking_ref,
      serviceDate: booking.service_date,
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
    const result = await pool.query(
      `UPDATE reservations SET status=$1 WHERE reservation_id=$2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Booking not found" });
    res.status(200).json({ message: "Status updated", booking: result.rows[0] });
  } catch (error) {
    logger.error(`overrideStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getAvailableSlots = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query param is required (YYYY-MM-DD)" });

  try {
    const configResult = await pool.query(`SELECT * FROM working_config LIMIT 1`);
    const config = configResult.rows[0];
    const dayOfWeek = new Date(date).getDay();
    const workingDays = config.working_days.split(",").map(Number);

    if (!workingDays.includes(dayOfWeek))
      return res.status(200).json({ available: false, reason: "Not a working day", slots: [] });

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reservations WHERE service_date=$1 AND status NOT IN ('Cancelled','No-show')`,
      [date]
    );
    const booked = parseInt(countResult.rows[0].count);

    if (booked >= config.daily_capacity)
      return res.status(200).json({ available: false, reason: "Daily capacity reached", slots: [] });

    const slots = await pool.query(`SELECT * FROM time_slots WHERE is_active=TRUE ORDER BY slot_time`);
    res.status(200).json({
      available: true,
      remaining_capacity: config.daily_capacity - booked,
      slots: slots.rows,
    });
  } catch (error) {
    logger.error(`getAvailableSlots failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listBookings, getBooking, createBooking, cancelBooking, overrideStatus, getAvailableSlots };
