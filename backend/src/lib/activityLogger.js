const prisma = require("./prisma");
const logger = require("../utils/logger");

// client can be the default prisma instance or a $transaction tx handle
const logActivity = async (client, { user_id, action, entity_type, entity_id }) => {
  try {
    await (client || prisma).activityLog.create({
      data: { user_id: user_id ?? null, action, entity_type: entity_type ?? null, entity_id: entity_id ?? null },
    });
  } catch (error) {
    logger.error(`logActivity failed — ${error.message}`);
  }
};

module.exports = { logActivity };