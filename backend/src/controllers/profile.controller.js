const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

const CUSTOMER_ROLE_ID = 5;

const updateProfile = async (req, res) => {
  const { user_id, role_id } = req.user;

  try {
    if (role_id === CUSTOMER_ROLE_ID) {
      const { full_name, phone, address } = req.body;
      if (!full_name) return res.status(400).json({ message: "full_name is required" });

      const profile = await prisma.customer.update({
        where: { user_id },
        data: { full_name: full_name.trim(), phone: phone || null, address: address || null },
      });
      return res.status(200).json({ message: "Profile updated", profile });
    } else {
      const { full_name, phone_no } = req.body;
      if (!full_name) return res.status(400).json({ message: "full_name is required" });

      const profile = await prisma.staff.update({
        where: { user_id },
        data: { full_name: full_name.trim(), phone_no: phone_no || null },
      });
      return res.status(200).json({ message: "Profile updated", profile });
    }
  } catch (error) {
    logger.error(`updateProfile failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const changePassword = async (req, res) => {
  const { user_id } = req.user;
  const { current_password, new_password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { user_id },
      select: { password_hash: true },
    });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    const newHash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({ where: { user_id }, data: { password_hash: newHash } });

    logger.info(`Password changed for user_id: ${user_id}`);
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    logger.error(`changePassword failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { updateProfile, changePassword };
