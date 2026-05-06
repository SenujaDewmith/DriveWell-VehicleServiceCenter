const pool = require("../config/db");
const logger = require("../utils/logger");

const listPackages = async (req, res) => {
  try {
    const showAll = req.user?.role_id === 1; // manager sees inactive too
    const query = showAll
      ? `SELECT * FROM service_packages ORDER BY created_at DESC`
      : `SELECT * FROM service_packages WHERE is_active = TRUE ORDER BY name`;
    const result = await pool.query(query);
    res.status(200).json({ packages: result.rows });
  } catch (error) {
    logger.error(`listPackages failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getPackage = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM service_packages WHERE package_id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ package: result.rows[0] });
  } catch (error) {
    logger.error(`getPackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createPackage = async (req, res) => {
  const { name, description, estimated_duration, price } = req.body;
  if (!name || !estimated_duration || price === undefined)
    return res.status(400).json({ message: "name, estimated_duration, and price are required" });

  try {
    const result = await pool.query(
      `INSERT INTO service_packages (name, description, estimated_duration, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description || null, estimated_duration, price]
    );
    logger.info(`Package created — package_id: ${result.rows[0].package_id}`);
    res.status(201).json({ message: "Package created", package: result.rows[0] });
  } catch (error) {
    logger.error(`createPackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updatePackage = async (req, res) => {
  const { name, description, estimated_duration, price } = req.body;
  if (!name || !estimated_duration || price === undefined)
    return res.status(400).json({ message: "name, estimated_duration, and price are required" });

  try {
    const result = await pool.query(
      `UPDATE service_packages SET name=$1, description=$2, estimated_duration=$3, price=$4
       WHERE package_id=$5 RETURNING *`,
      [name.trim(), description || null, estimated_duration, price, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ message: "Package updated", package: result.rows[0] });
  } catch (error) {
    logger.error(`updatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deactivatePackage = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE service_packages SET is_active = FALSE WHERE package_id=$1 RETURNING package_id, name`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ message: "Package deactivated", package: result.rows[0] });
  } catch (error) {
    logger.error(`deactivatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const activatePackage = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE service_packages SET is_active = TRUE WHERE package_id=$1 RETURNING package_id, name`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ message: "Package activated", package: result.rows[0] });
  } catch (error) {
    logger.error(`activatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listPackages, getPackage, createPackage, updatePackage, deactivatePackage, activatePackage };
