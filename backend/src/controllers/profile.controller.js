const pool = require("../config/db");
const logger = require("../utils/logger");

const updateProfile = async (req, res) => {
  const { user_id, role_id } = req.user;
  const CUSTOMER_ROLE_ID = 5;

  try {
    if (role_id === CUSTOMER_ROLE_ID) {
      const { full_name, phone, address } = req.body;
      if (!full_name) return res.status(400).json({ message: "full_name is required" });

      const result = await pool.query(
        `UPDATE customers SET full_name = $1, phone = $2, address = $3
         WHERE user_id = $4 RETURNING full_name, phone, address`,
        [full_name.trim(), phone || null, address || null, user_id]
      );
      return res.status(200).json({ message: "Profile updated", profile: result.rows[0] });
    } else {
      const { full_name, phone_no } = req.body;
      if (!full_name) return res.status(400).json({ message: "full_name is required" });

      const result = await pool.query(
        `UPDATE staff SET full_name = $1, phone_no = $2
         WHERE user_id = $3 RETURNING full_name, phone_no`,
        [full_name.trim(), phone_no || null, user_id]
      );
      return res.status(200).json({ message: "Profile updated", profile: result.rows[0] });
    }
  } catch (error) {
    logger.error(`updateProfile failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const changePassword = async (req, res) => {
  const { user_id } = req.user;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ message: "current_password and new_password are required" });

  if (new_password.length < 6)
    return res.status(400).json({ message: "New password must be at least 6 characters" });

  try {
    const bcrypt = require("bcryptjs");
    const result = await pool.query("SELECT password_hash FROM users WHERE user_id = $1", [user_id]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [newHash, user_id]);

    logger.info(`Password changed for user_id: ${user_id}`);
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    logger.error(`changePassword failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { updateProfile, changePassword };
