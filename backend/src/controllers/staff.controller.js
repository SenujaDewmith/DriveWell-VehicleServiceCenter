const pool = require("../config/db");
const logger = require("../utils/logger");

const myServices = async (req, res) => {
  const { user_id } = req.user;
  const { from, to } = req.query;

  try {
    const conditions = [`ssa.staff_id = $1`];
    const values = [user_id];
    let i = 2;
    if (from) { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`r.service_date <= $${i++}`); values.push(to); }

    const result = await pool.query(
      `SELECT
         r.reservation_id, r.booking_ref, r.service_date, r.status,
         c.full_name AS customer_name,
         v.make, v.model, v.plate_no,
         p.name AS package_name,
         ssa.task_type,
         sr.remarks, sr.additional_work,
         f.rating, f.comment AS feedback_comment
       FROM service_staff_assignments ssa
       JOIN service_records sr ON sr.record_id = ssa.record_id
       JOIN reservations r ON r.reservation_id = sr.reservation_id
       JOIN customers c ON c.user_id = r.customer_id
       JOIN vehicles v ON v.vehicle_id = r.vehicle_id
       JOIN service_packages p ON p.package_id = r.package_id
       LEFT JOIN feedback f ON f.reservation_id = r.reservation_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.service_date DESC`,
      values
    );
    res.status(200).json({ services: result.rows });
  } catch (error) {
    logger.error(`myServices failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const myPerformance = async (req, res) => {
  const { user_id } = req.user;
  const { from, to } = req.query;

  try {
    const conditions = [`ssa.staff_id = $1`];
    const values = [user_id];
    let i = 2;
    if (from) { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT ssa.record_id) AS jobs_completed,
         ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
         COUNT(f.feedback_id) AS feedback_count,
         MIN(r.service_date) AS first_service,
         MAX(r.service_date) AS last_service
       FROM service_staff_assignments ssa
       JOIN service_records sr ON sr.record_id = ssa.record_id
       JOIN reservations r ON r.reservation_id = sr.reservation_id
       LEFT JOIN feedback f ON f.reservation_id = r.reservation_id
       ${where}`,
      values
    );

    // Rating breakdown
    const ratingBreakdown = await pool.query(
      `SELECT f.rating, COUNT(*) AS count
       FROM service_staff_assignments ssa
       JOIN service_records sr ON sr.record_id = ssa.record_id
       JOIN reservations r ON r.reservation_id = sr.reservation_id
       JOIN feedback f ON f.reservation_id = r.reservation_id
       ${where}
       GROUP BY f.rating ORDER BY f.rating DESC`,
      values
    );

    res.status(200).json({
      performance: result.rows[0],
      rating_breakdown: ratingBreakdown.rows,
    });
  } catch (error) {
    logger.error(`myPerformance failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { myServices, myPerformance };
