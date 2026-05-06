const pool = require("../config/db");
const logger = require("../utils/logger");

const CUSTOMER_ROLE = 5;

const listFeedback = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { from, to } = req.query;

  try {
    let conditions = [];
    let values = [];
    let i = 1;

    if (role_id === CUSTOMER_ROLE) {
      conditions.push(`f.customer_id = $${i++}`);
      values.push(user_id);
    }
    if (from) { conditions.push(`f.submitted_at >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`f.submitted_at <= $${i++}`); values.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT f.*, r.booking_ref, r.service_date, p.name AS package_name,
              c.full_name AS customer_name
       FROM feedback f
       JOIN reservations r ON r.reservation_id = f.reservation_id
       JOIN service_packages p ON p.package_id = r.package_id
       JOIN customers c ON c.user_id = f.customer_id
       ${where}
       ORDER BY f.submitted_at DESC`,
      values
    );
    res.status(200).json({ feedback: result.rows });
  } catch (error) {
    logger.error(`listFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const submitFeedback = async (req, res) => {
  const { user_id } = req.user;
  const { reservation_id, rating, comment } = req.body;

  if (!reservation_id || !rating)
    return res.status(400).json({ message: "reservation_id and rating are required" });

  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be between 1 and 5" });

  try {
    // Verify booking belongs to customer and is completed
    const bookingResult = await pool.query(
      `SELECT status, customer_id FROM reservations WHERE reservation_id=$1`,
      [reservation_id]
    );
    if (bookingResult.rows.length === 0) return res.status(404).json({ message: "Booking not found" });

    const booking = bookingResult.rows[0];
    if (booking.customer_id !== user_id) return res.status(403).json({ message: "Access denied" });
    if (!["Completed", "Ready for Pickup"].includes(booking.status))
      return res.status(400).json({ message: "Feedback can only be submitted for completed services" });

    const result = await pool.query(
      `INSERT INTO feedback (reservation_id, customer_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [reservation_id, user_id, rating, comment || null]
    );
    logger.info(`Feedback submitted — feedback_id: ${result.rows[0].feedback_id}`);
    res.status(201).json({ message: "Feedback submitted", feedback: result.rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ message: "Feedback already submitted for this booking" });
    logger.error(`submitFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getFeedbackByBooking = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT f.*, c.full_name AS customer_name FROM feedback f
       JOIN customers c ON c.user_id = f.customer_id
       WHERE f.reservation_id = $1`,
      [booking_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "No feedback for this booking" });
    res.status(200).json({ feedback: result.rows[0] });
  } catch (error) {
    logger.error(`getFeedbackByBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listFeedback, submitFeedback, getFeedbackByBooking };
