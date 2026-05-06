const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");

const listStaff = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.role_id, u.account_status, u.created_at,
              ro.role_name, s.full_name, s.phone_no
       FROM users u
       JOIN roles ro ON ro.role_id = u.role_id
       LEFT JOIN staff s ON s.user_id = u.user_id
       WHERE u.role_id IN (1, 2, 3, 4)
       ORDER BY u.created_at DESC`
    );
    res.status(200).json({ staff: result.rows });
  } catch (error) {
    logger.error(`listStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getStaffMember = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.role_id, u.account_status, u.created_at,
              ro.role_name, s.full_name, s.phone_no
       FROM users u
       JOIN roles ro ON ro.role_id = u.role_id
       LEFT JOIN staff s ON s.user_id = u.user_id
       WHERE u.user_id = $1 AND u.role_id IN (1, 2, 3, 4)`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Staff member not found" });
    res.status(200).json({ staff: result.rows[0] });
  } catch (error) {
    logger.error(`getStaffMember failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createStaff = async (req, res) => {
  const { email, password, full_name, role_id, phone_no } = req.body;

  if (!email || !password || !full_name || !role_id)
    return res.status(400).json({ message: "email, password, full_name, and role_id are required" });

  if (![1, 2, 3, 4].includes(parseInt(role_id)))
    return res.status(400).json({ message: "role_id must be 1 (Manager), 2 (Supervisor), 3 (Cashier), or 4 (Service Staff)" });

  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT user_id FROM users WHERE email=$1", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role_id) VALUES ($1, $2, $3) RETURNING user_id, email, role_id`,
      [email, hash, role_id]
    );
    await client.query(
      `INSERT INTO staff (user_id, full_name, phone_no) VALUES ($1, $2, $3)`,
      [userResult.rows[0].user_id, full_name.trim(), phone_no || null]
    );

    await client.query("COMMIT");
    logger.info(`Staff account created — user_id: ${userResult.rows[0].user_id}, role_id: ${role_id}`);
    res.status(201).json({ message: "Staff account created", user: userResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`createStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { full_name, phone_no, email } = req.body;

  if (!full_name) return res.status(400).json({ message: "full_name is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (email) {
      await client.query(`UPDATE users SET email=$1 WHERE user_id=$2`, [email, id]);
    }
    const result = await client.query(
      `UPDATE staff SET full_name=$1, phone_no=$2 WHERE user_id=$3 RETURNING *`,
      [full_name.trim(), phone_no || null, id]
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff member not found" });
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Staff updated", staff: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`updateStaff failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const setAccountStatus = async (req, res) => {
  const { id } = req.params;
  const { account_status } = req.body;

  if (!["active", "inactive"].includes(account_status))
    return res.status(400).json({ message: "account_status must be 'active' or 'inactive'" });

  try {
    const result = await pool.query(
      `UPDATE users SET account_status=$1 WHERE user_id=$2 AND role_id IN (1,2,3,4) RETURNING user_id, email, account_status`,
      [account_status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Staff member not found" });
    logger.info(`User ${id} status set to ${account_status}`);
    res.status(200).json({ message: "Account status updated", user: result.rows[0] });
  } catch (error) {
    logger.error(`setAccountStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6)
    return res.status(400).json({ message: "new_password must be at least 6 characters" });

  try {
    const hash = await bcrypt.hash(new_password, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash=$1 WHERE user_id=$2 AND role_id IN (1,2,3,4) RETURNING user_id`,
      [hash, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Staff member not found" });
    logger.info(`Password reset for user_id: ${id}`);
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    logger.error(`resetPassword failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listCustomers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.account_status, u.created_at,
              c.full_name, c.phone, c.address
       FROM users u JOIN customers c ON c.user_id = u.user_id
       ORDER BY u.created_at DESC`
    );
    res.status(200).json({ customers: result.rows });
  } catch (error) {
    logger.error(`listCustomers failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listStaff, getStaffMember, createStaff, updateStaff, setAccountStatus, resetPassword, listCustomers };
