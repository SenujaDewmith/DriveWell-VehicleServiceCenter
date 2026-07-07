const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { serialize } = require("../lib/format");

// Build a safe WHERE fragment from optional date range filters
const dateWhere = (from, to, alias = "r") =>
  [
    from ? Prisma.sql`${Prisma.raw(alias)}.service_date >= ${new Date(from)}` : null,
    to   ? Prisma.sql`${Prisma.raw(alias)}.service_date <= ${new Date(to)}`   : null,
  ].filter(Boolean);

const revenueReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = dateWhere(from, to);
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

    const [summary] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(i.total_amount), 0)                                              AS total_revenue,
        COUNT(i.invoice_id)                                                           AS total_invoices,
        COALESCE(SUM(CASE WHEN i.payment_status='Paid'   THEN i.total_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN i.payment_status='Unpaid' THEN i.total_amount ELSE 0 END), 0) AS unpaid_revenue
      FROM invoices i
      JOIN reservations r ON r.reservation_id = i.reservation_id
      ${where}
    `;

    const by_package = await prisma.$queryRaw`
      SELECT p.name AS package_name, COUNT(i.invoice_id) AS count,
             COALESCE(SUM(i.total_amount), 0) AS revenue
      FROM invoices i
      JOIN reservations r     ON r.reservation_id = i.reservation_id
      JOIN service_packages p ON p.package_id = r.package_id
      ${where}
      GROUP BY p.name ORDER BY revenue DESC
    `;

    const by_date = await prisma.$queryRaw`
      SELECT r.service_date, COALESCE(SUM(i.total_amount), 0) AS revenue, COUNT(*) AS count
      FROM invoices i
      JOIN reservations r ON r.reservation_id = i.reservation_id
      ${where}
      GROUP BY r.service_date ORDER BY r.service_date
    `;

    res.status(200).json(serialize({ summary, by_package, by_date }));
  } catch (error) {
    logger.error(`revenueReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const volumeReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const extraConditions = dateWhere(from, to);
    const where = Prisma.sql`WHERE r.status NOT IN ('Cancelled','No-show')${extraConditions.length ? Prisma.sql` AND ${Prisma.join(extraConditions, " AND ")}` : Prisma.empty}`;

    const by_status = await prisma.$queryRaw`
      SELECT status, COUNT(*) AS count FROM reservations r ${where} GROUP BY status
    `;

    const by_package = await prisma.$queryRaw`
      SELECT p.name AS package_name, COUNT(*) AS count
      FROM reservations r JOIN service_packages p ON p.package_id = r.package_id
      ${where} GROUP BY p.name ORDER BY count DESC
    `;

    const by_date = await prisma.$queryRaw`
      SELECT r.service_date, COUNT(*) AS count
      FROM reservations r ${where}
      GROUP BY r.service_date ORDER BY r.service_date
    `;

    res.status(200).json(serialize({ by_status, by_package, by_date }));
  } catch (error) {
    logger.error(`volumeReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const staffPerformanceReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const conditions = dateWhere(from, to);
    const dateFilter = conditions.length
      ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

    const staff_performance = await prisma.$queryRaw`
      SELECT
        st.user_id AS staff_id, st.full_name, u.email, ro.role_name,
        COUNT(DISTINCT ssa.record_id)    AS jobs_completed,
        ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
        COUNT(f.feedback_id)             AS feedback_count
      FROM staff st
      JOIN users u  ON u.user_id  = st.user_id
      JOIN roles ro ON ro.role_id = u.role_id
      LEFT JOIN service_staff_assignments ssa ON ssa.staff_id = st.user_id
      LEFT JOIN service_records sr            ON sr.record_id = ssa.record_id
      LEFT JOIN reservations r                ON r.reservation_id = sr.reservation_id ${dateFilter}
      LEFT JOIN feedback f                    ON f.reservation_id = r.reservation_id
      WHERE u.role_id = 4
      GROUP BY st.user_id, st.full_name, u.email, ro.role_name
      ORDER BY jobs_completed DESC
    `;

    res.status(200).json(serialize({ staff_performance }));
  } catch (error) {
    logger.error(`staffPerformanceReport failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const activityLog = async (req, res) => {
  const { from, to, limit = 100 } = req.query;
  try {
    const conditions = [];
    if (from) conditions.push(Prisma.sql`al.created_at >= ${new Date(from)}`);
    if (to)   conditions.push(Prisma.sql`al.created_at <= ${new Date(to)}`);
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

    const logs = await prisma.$queryRaw`
      SELECT al.*, u.email FROM activity_log al
      LEFT JOIN users u ON u.user_id = al.user_id
      ${where} ORDER BY al.created_at DESC LIMIT ${parseInt(limit)}
    `;

    res.status(200).json(serialize({ logs }));
  } catch (error) {
    logger.error(`activityLog failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { revenueReport, volumeReport, staffPerformanceReport, activityLog };
