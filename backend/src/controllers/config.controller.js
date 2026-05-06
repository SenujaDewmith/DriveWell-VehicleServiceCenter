const pool = require("../config/db");
const logger = require("../utils/logger");

const getConfig = async (req, res) => {
  try {
    const config = await pool.query(`SELECT * FROM working_config LIMIT 1`);
    const slots = await pool.query(`SELECT * FROM time_slots ORDER BY slot_time`);
    res.status(200).json({ config: config.rows[0], slots: slots.rows });
  } catch (error) {
    logger.error(`getConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateConfig = async (req, res) => {
  const { daily_capacity, working_days } = req.body;
  if (!daily_capacity || !working_days)
    return res.status(400).json({ message: "daily_capacity and working_days are required" });

  try {
    const result = await pool.query(
      `UPDATE working_config SET daily_capacity=$1, working_days=$2 RETURNING *`,
      [daily_capacity, working_days]
    );
    logger.info(`Working config updated by manager user_id: ${req.user.user_id}`);
    res.status(200).json({ message: "Config updated", config: result.rows[0] });
  } catch (error) {
    logger.error(`updateConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const addSlot = async (req, res) => {
  const { slot_time } = req.body;
  if (!slot_time) return res.status(400).json({ message: "slot_time is required (HH:MM)" });

  try {
    const result = await pool.query(
      `INSERT INTO time_slots (slot_time) VALUES ($1) RETURNING *`,
      [slot_time]
    );
    res.status(201).json({ message: "Slot added", slot: result.rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(400).json({ message: "Slot already exists" });
    logger.error(`addSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const toggleSlot = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (is_active === undefined) return res.status(400).json({ message: "is_active is required" });

  try {
    const result = await pool.query(
      `UPDATE time_slots SET is_active=$1 WHERE slot_id=$2 RETURNING *`,
      [is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Slot not found" });
    res.status(200).json({ message: "Slot updated", slot: result.rows[0] });
  } catch (error) {
    logger.error(`toggleSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteSlot = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM time_slots WHERE slot_id=$1 RETURNING slot_id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Slot not found" });
    res.status(200).json({ message: "Slot deleted" });
  } catch (error) {
    logger.error(`deleteSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getConfig, updateConfig, addSlot, toggleSlot, deleteSlot };
