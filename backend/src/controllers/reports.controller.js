const pool = require("../config/db");
const logger = require("../utils/logger");

const revenueReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = [];
    const values = [];
    let i = 1;
    if (from) { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Overall total
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(i.total_amount), 0) AS total_revenue,
              COUNT(i.invoice_id) AS total_invoices,
              COALESCE(SUM(CASE WHEN i.payment_status='Paid' THEN i.total_amount ELSE 0 END), 0) AS paid_revenue,
              COALESCE(SUM(CASE WHEN i.payment_status='Unpaid' THEN i.total_amount ELSE 0 END), 0) AS unpaid_revenue
       FROM invoices i JOIN reservations r ON r.reservation_id = i.reservation_id ${where}`,
      values
    );

    // Revenue by package
    const byPackage = await pool.query(
      `SELECT p.name AS package_name, COUNT(i.invoice_id) AS count,
              COALESCE(SUM(i.total_amount), 0) AS revenue
       FROM invoices i
       JOIN reservations r ON r.reservation_id = i.reservation_id
       JOIN service_packages p ON p.package_id = r.package_id
       ${where}
       GROUP BY p.name ORDER BY revenue DESC`,
      values
    );

    // Revenue by date
    const byDate = await pool.query(
      `SELECT r.service_date, COALESCE(SUM(i.total_amount), 0) AS revenue, COUNT(*) AS count
       FROM invoices i JOIN reservations r ON r.reservation_id = i.reservation_id
       ${where}
       GROUP BY r.service_date ORDER BY r.service_date`,
      values
    );

    res.status(200).json({
      summary: totalResult.rows[0],
      by_package: byPackage.rows,
      by_date: byDate.rows,
    });
  } catch (error) {
    logger.error(`revenueReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const volumeReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = ["r.status NOT IN ('Cancelled','No-show')"];
    const values = [];
    let i = 1;
    if (from) { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const total = await pool.query(
      `SELECT COUNT(*) AS total, status, COUNT(*) AS count
       FROM reservations r ${where} GROUP BY status`,
      values
    );

    const byPackage = await pool.query(
      `SELECT p.name AS package_name, COUNT(*) AS count
       FROM reservations r JOIN service_packages p ON p.package_id=r.package_id
       ${where} GROUP BY p.name ORDER BY count DESC`,
      values
    );

    const byDate = await pool.query(
      `SELECT r.service_date, COUNT(*) AS count
       FROM reservations r ${where}
       GROUP BY r.service_date ORDER BY r.service_date`,
      values
    );

    res.status(200).json({ by_status: total.rows, by_package: byPackage.rows, by_date: byDate.rows });
  } catch (error) {
    logger.error(`volumeReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const staffPerformanceReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = [];
    const values = [];
    let i = 1;
    if (from) { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    const dateWhere = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         st.user_id AS staff_id,
         st.full_name,
         u.email,
         ro.role_name,
         COUNT(DISTINCT ssa.record_id) AS jobs_completed,
         ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
         COUNT(f.feedback_id) AS feedback_count
       FROM staff st
       JOIN users u ON u.user_id = st.user_id
       JOIN roles ro ON ro.role_id = u.role_id
       LEFT JOIN service_staff_assignments ssa ON ssa.staff_id = st.user_id
       LEFT JOIN service_records sr ON sr.record_id = ssa.record_id
       LEFT JOIN reservations r ON r.reservation_id = sr.reservation_id ${dateWhere}
       LEFT JOIN feedback f ON f.reservation_id = r.reservation_id
       WHERE u.role_id = 4
       GROUP BY st.user_id, st.full_name, u.email, ro.role_name
       ORDER BY jobs_completed DESC`,
      values
    );
    res.status(200).json({ staff_performance: result.rows });
  } catch (error) {
    logger.error(`staffPerformanceReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const activityLog = async (req, res) => {
  const { from, to, limit = 100 } = req.query;
  try {
    const conditions = [];
    const values = [];
    let i = 1;
    if (from) { conditions.push(`al.created_at >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`al.created_at <= $${i++}`); values.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(limit);

    const result = await pool.query(
      `SELECT al.*, u.email FROM activity_log al
       LEFT JOIN users u ON u.user_id = al.user_id
       ${where} ORDER BY al.created_at DESC LIMIT $${i}`,
      values
    );
    res.status(200).json({ logs: result.rows });
  } catch (error) {
    logger.error(`activityLog failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { revenueReport, volumeReport, staffPerformanceReport, activityLog };
