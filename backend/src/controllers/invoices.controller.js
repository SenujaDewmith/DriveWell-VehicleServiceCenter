const pool = require("../config/db");
const logger = require("../utils/logger");

const CUSTOMER_ROLE = 5;

const INVOICE_QUERY = `
  SELECT
    i.*,
    r.booking_ref, r.service_date, r.status AS booking_status,
    c.full_name AS customer_name, u.email AS customer_email,
    v.make, v.model, v.plate_no,
    p.name AS package_name,
    st.full_name AS cashier_name
  FROM invoices i
  JOIN reservations r   ON r.reservation_id = i.reservation_id
  JOIN customers c      ON c.user_id = r.customer_id
  JOIN users u          ON u.user_id = r.customer_id
  JOIN vehicles v       ON v.vehicle_id = r.vehicle_id
  JOIN service_packages p ON p.package_id = r.package_id
  LEFT JOIN staff st    ON st.user_id = i.cashier_id
`;

const listInvoices = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { from, to, payment_status } = req.query;

  try {
    let conditions = [];
    let values = [];
    let i = 1;

    if (role_id === CUSTOMER_ROLE) {
      conditions.push(`r.customer_id = $${i++}`);
      values.push(user_id);
    }
    if (from)           { conditions.push(`r.service_date >= $${i++}`); values.push(from); }
    if (to)             { conditions.push(`r.service_date <= $${i++}`); values.push(to); }
    if (payment_status) { conditions.push(`i.payment_status = $${i++}`); values.push(payment_status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`${INVOICE_QUERY} ${where} ORDER BY i.generated_at DESC`, values);
    res.status(200).json({ invoices: result.rows });
  } catch (error) {
    logger.error(`listInvoices failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getInvoice = async (req, res) => {
  const { user_id, role_id } = req.user;
  try {
    const result = await pool.query(`${INVOICE_QUERY} WHERE i.invoice_id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Invoice not found" });

    const invoice = result.rows[0];
    if (role_id === CUSTOMER_ROLE) {
      const ownerCheck = await pool.query(
        `SELECT customer_id FROM reservations WHERE reservation_id=$1`,
        [invoice.reservation_id]
      );
      if (ownerCheck.rows[0]?.customer_id !== user_id)
        return res.status(403).json({ message: "Access denied" });
    }
    res.status(200).json({ invoice });
  } catch (error) {
    logger.error(`getInvoice failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createInvoice = async (req, res) => {
  const { user_id } = req.user;
  const { reservation_id, base_amount, additional_charges, discount, payment_method, notes } = req.body;

  if (!reservation_id || base_amount === undefined)
    return res.status(400).json({ message: "reservation_id and base_amount are required" });

  const add = parseFloat(additional_charges) || 0;
  const dis = parseFloat(discount) || 0;
  const total = parseFloat(base_amount) + add - dis;

  try {
    // Booking must be in Completed or Ready for Pickup state
    const bookingResult = await pool.query(
      `SELECT status FROM reservations WHERE reservation_id=$1`,
      [reservation_id]
    );
    if (bookingResult.rows.length === 0) return res.status(404).json({ message: "Booking not found" });
    if (!["Completed", "Ready for Pickup"].includes(bookingResult.rows[0].status))
      return res.status(400).json({ message: "Can only generate invoice for Completed or Ready for Pickup bookings" });

    const result = await pool.query(
      `INSERT INTO invoices (reservation_id, cashier_id, base_amount, additional_charges, discount, total_amount, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [reservation_id, user_id, base_amount, add, dis, total, payment_method || null, notes || null]
    );

    logger.info(`Invoice created — invoice_id: ${result.rows[0].invoice_id}, reservation_id: ${reservation_id}`);
    res.status(201).json({ message: "Invoice created", invoice: result.rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ message: "Invoice already exists for this booking" });
    logger.error(`createInvoice failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { payment_status, payment_method } = req.body;

  if (!payment_status || !["Paid", "Unpaid"].includes(payment_status))
    return res.status(400).json({ message: "payment_status must be 'Paid' or 'Unpaid'" });

  try {
    const result = await pool.query(
      `UPDATE invoices SET payment_status=$1, payment_method=$2 WHERE invoice_id=$3 RETURNING *`,
      [payment_status, payment_method || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Invoice not found" });
    logger.info(`Invoice ${id} payment status set to ${payment_status}`);
    res.status(200).json({ message: "Payment status updated", invoice: result.rows[0] });
  } catch (error) {
    logger.error(`updatePaymentStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listInvoices, getInvoice, createInvoice, updatePaymentStatus };
