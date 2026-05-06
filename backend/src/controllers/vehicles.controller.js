const pool = require("../config/db");
const logger = require("../utils/logger");

const listVehicles = async (req, res) => {
  const { user_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );
    res.status(200).json({ vehicles: result.rows });
  } catch (error) {
    logger.error(`listVehicles failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const addVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { make, model, year, plate_no, color } = req.body;

  if (!make || !model || !plate_no)
    return res.status(400).json({ message: "make, model, and plate_no are required" });

  try {
    const result = await pool.query(
      `INSERT INTO vehicles (customer_id, make, model, year, plate_no, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, make.trim(), model.trim(), year || null, plate_no.trim().toUpperCase(), color || null]
    );
    logger.info(`Vehicle added — vehicle_id: ${result.rows[0].vehicle_id}, user_id: ${user_id}`);
    res.status(201).json({ message: "Vehicle added", vehicle: result.rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ message: "Plate number already registered" });
    logger.error(`addVehicle failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const { make, model, year, plate_no, color } = req.body;

  if (!make || !model || !plate_no)
    return res.status(400).json({ message: "make, model, and plate_no are required" });

  try {
    const result = await pool.query(
      `UPDATE vehicles SET make=$1, model=$2, year=$3, plate_no=$4, color=$5
       WHERE vehicle_id=$6 AND customer_id=$7 RETURNING *`,
      [make.trim(), model.trim(), year || null, plate_no.trim().toUpperCase(), color || null, id, user_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Vehicle not found" });

    res.status(200).json({ message: "Vehicle updated", vehicle: result.rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ message: "Plate number already registered" });
    logger.error(`updateVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM vehicles WHERE vehicle_id=$1 AND customer_id=$2 RETURNING vehicle_id`,
      [id, user_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Vehicle not found" });

    res.status(200).json({ message: "Vehicle deleted" });
  } catch (error) {
    if (error.code === "23503")
      return res.status(400).json({ message: "Cannot delete vehicle with existing bookings" });
    logger.error(`deleteVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listVehicles, addVehicle, updateVehicle, deleteVehicle };
