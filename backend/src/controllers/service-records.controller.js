const pool = require("../config/db");
const logger = require("../utils/logger");
const { sendStatusUpdate } = require("../services/email.service");

const NOTIFY_STATUSES = ["Completed", "Ready for Pickup"];

const getServiceRecord = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const record = await pool.query(
      `SELECT sr.*, s.full_name AS supervisor_name
       FROM service_records sr
       LEFT JOIN staff s ON s.user_id = sr.supervisor_id
       WHERE sr.reservation_id = $1`,
      [booking_id]
    );
    if (record.rows.length === 0)
      return res.status(404).json({ message: "Service record not found" });

    const assignments = await pool.query(
      `SELECT ssa.*, st.full_name AS staff_name
       FROM service_staff_assignments ssa
       JOIN staff st ON st.user_id = ssa.staff_id
       WHERE ssa.record_id = $1`,
      [record.rows[0].record_id]
    );

    res.status(200).json({ record: record.rows[0], assignments: assignments.rows });
  } catch (error) {
    logger.error(`getServiceRecord failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createServiceRecord = async (req, res) => {
  const { user_id } = req.user;
  const { booking_id } = req.params;
  const { remarks, additional_work, consumables, additional_charges } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify booking exists and is in a startable state
    const bookingResult = await client.query(
      `SELECT status FROM reservations WHERE reservation_id=$1`,
      [booking_id]
    );
    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }
    if (!["Booked", "Started"].includes(bookingResult.rows[0].status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Booking is not in a state that can be started" });
    }

    // Prevent duplicate records
    const existing = await client.query(
      `SELECT record_id FROM service_records WHERE reservation_id=$1`,
      [booking_id]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Service record already exists for this booking" });
    }

    const result = await client.query(
      `INSERT INTO service_records (reservation_id, supervisor_id, remarks, additional_work, consumables, additional_charges, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [booking_id, user_id, remarks || null, additional_work || null, consumables || null, additional_charges || 0]
    );

    await client.query(
      `UPDATE reservations SET status='Started' WHERE reservation_id=$1`,
      [booking_id]
    );

    await client.query("COMMIT");
    logger.info(`Service record created — record_id: ${result.rows[0].record_id}`);
    res.status(201).json({ message: "Service record created", record: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`createServiceRecord failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateServiceRecord = async (req, res) => {
  const { booking_id } = req.params;
  const { remarks, additional_work, consumables, additional_charges, quality_checked } = req.body;

  try {
    const result = await pool.query(
      `UPDATE service_records
       SET remarks=$1, additional_work=$2, consumables=$3, additional_charges=$4, quality_checked=$5
       WHERE reservation_id=$6 RETURNING *`,
      [remarks || null, additional_work || null, consumables || null, additional_charges ?? 0, quality_checked ?? false, booking_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Service record not found" });
    res.status(200).json({ message: "Service record updated", record: result.rows[0] });
  } catch (error) {
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updates = {};
    if (status === "Completed") updates.completed_at = "NOW()";

    const setClause = Object.keys(updates).map(k => `${k} = ${updates[k]}`).join(", ");
    if (setClause) {
      await client.query(
        `UPDATE service_records SET ${setClause} WHERE reservation_id=$1`,
        [booking_id]
      );
    }

    const bookingResult = await client.query(
      `UPDATE reservations SET status=$1 WHERE reservation_id=$2
       RETURNING reservation_id, booking_ref, customer_id`,
      [status, booking_id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    await client.query("COMMIT");

    if (NOTIFY_STATUSES.includes(status)) {
      const booking = bookingResult.rows[0];
      const customerResult = await pool.query(
        `SELECT u.email, c.full_name FROM users u JOIN customers c ON c.user_id=u.user_id WHERE u.user_id=$1`,
        [booking.customer_id]
      );
      const { email, full_name } = customerResult.rows[0];
      sendStatusUpdate(email, { customerName: full_name, bookingRef: booking.booking_ref, status });
    }

    logger.info(`Service status updated to '${status}' for reservation_id: ${booking_id}`);
    res.status(200).json({ message: "Status updated", status });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`updateStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const assignStaff = async (req, res) => {
  const { booking_id } = req.params;
  const { staff_id, task_type } = req.body;

  if (!staff_id || !task_type)
    return res.status(400).json({ message: "staff_id and task_type are required" });

  try {
    const recordResult = await pool.query(
      `SELECT record_id FROM service_records WHERE reservation_id=$1`,
      [booking_id]
    );
    if (recordResult.rows.length === 0)
      return res.status(404).json({ message: "Service record not found" });

    const result = await pool.query(
      `INSERT INTO service_staff_assignments (record_id, staff_id, task_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (record_id, staff_id, task_type) DO NOTHING
       RETURNING *`,
      [recordResult.rows[0].record_id, staff_id, task_type]
    );
    res.status(201).json({ message: "Staff assigned", assignment: result.rows[0] || null });
  } catch (error) {
    logger.error(`assignStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const removeStaffAssignment = async (req, res) => {
  const { assignment_id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM service_staff_assignments WHERE assignment_id=$1 RETURNING assignment_id`,
      [assignment_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Assignment not found" });
    res.status(200).json({ message: "Staff assignment removed" });
  } catch (error) {
    logger.error(`removeStaffAssignment failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getServiceRecord, createServiceRecord, updateServiceRecord,
  updateStatus, assignStaff, removeStaffAssignment,
};
