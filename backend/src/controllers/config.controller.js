const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtTime, fmtDate } = require("../lib/format");
const { logActivity } = require("../lib/activityLogger");

const toTimeDate = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const normalizeTime = (t) => t.slice(0, 5); // "HH:MM" — comparable regardless of "HH:MM" vs "HH:MM:SS" input

const flattenBlockedTime = (b) => ({
  ...b,
  date: b.date ? fmtDate(b.date) : null,
  start_time: fmtTime(b.start_time),
  end_time: fmtTime(b.end_time),
});

const getConfig = async (req, res) => {
  try {
    const config = await prisma.workingConfig.findFirst();
    const blockedTimes = await prisma.blockedTime.findMany({
      orderBy: [{ date: "asc" }, { start_time: "asc" }],
    });
    res.status(200).json({
      config: {
        ...config,
        day_start_time: fmtTime(config.day_start_time),
        day_end_time: fmtTime(config.day_end_time),
      },
      blocked_times: blockedTimes.map(flattenBlockedTime),
    });
  } catch (error) {
    logger.error(`getConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateConfig = async (req, res) => {
  const { working_days, day_start_time, day_end_time } = req.body;
  if (!working_days || !day_start_time || !day_end_time)
    return res.status(400).json({ message: "working_days, day_start_time, and day_end_time are required" });
  if (normalizeTime(day_end_time) <= normalizeTime(day_start_time))
    return res.status(400).json({ message: "day_end_time must be after day_start_time" });

  try {
    await prisma.workingConfig.updateMany({
      data: {
        working_days,
        day_start_time: toTimeDate(day_start_time),
        day_end_time: toTimeDate(day_end_time),
      },
    });
    logger.info(`Working config updated by manager user_id: ${req.user.user_id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "working_config", entity_id: null });
    const updated = await prisma.workingConfig.findFirst();
    res.status(200).json({
      message: "Config updated",
      config: { ...updated, day_start_time: fmtTime(updated.day_start_time), day_end_time: fmtTime(updated.day_end_time) },
    });
  } catch (error) {
    logger.error(`updateConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const addBlockedTime = async (req, res) => {
  const { date, start_time, end_time, reason } = req.body;
  if (!start_time || !end_time)
    return res.status(400).json({ message: "start_time and end_time are required (HH:MM)" });
  if (normalizeTime(end_time) <= normalizeTime(start_time))
    return res.status(400).json({ message: "end_time must be after start_time" });

  try {
    const block = await prisma.blockedTime.create({
      data: {
        date: date ? new Date(date) : null,
        start_time: toTimeDate(start_time),
        end_time: toTimeDate(end_time),
        reason: reason || null,
      },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "blocked_time", entity_id: block.block_id });
    res.status(201).json({ message: "Blocked time added", block: flattenBlockedTime(block) });
  } catch (error) {
    logger.error(`addBlockedTime failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteBlockedTime = async (req, res) => {
  try {
    const block = await prisma.blockedTime.delete({ where: { block_id: parseInt(req.params.id) } });
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "blocked_time", entity_id: block.block_id });
    res.status(200).json({ message: "Blocked time removed" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Blocked time not found" });
    logger.error(`deleteBlockedTime failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getConfig, updateConfig, addBlockedTime, deleteBlockedTime };
