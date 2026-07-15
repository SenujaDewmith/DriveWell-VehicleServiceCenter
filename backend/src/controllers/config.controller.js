const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtTime } = require("../lib/format");
const { logActivity } = require("../lib/activityLogger");

const getConfig = async (req, res) => {
  try {
    const config = await prisma.workingConfig.findFirst();
    const slots = await prisma.timeSlot.findMany({ orderBy: { slot_time: "asc" } });
    res.status(200).json({
      config,
      slots: slots.map((s) => ({ ...s, slot_time: fmtTime(s.slot_time) })),
    });
  } catch (error) {
    logger.error(`getConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateConfig = async (req, res) => {
  const { working_days } = req.body;
  if (!working_days)
    return res.status(400).json({ message: "working_days is required" });

  try {
    await prisma.workingConfig.updateMany({ data: { working_days } });
    logger.info(`Working config updated by manager user_id: ${req.user.user_id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "working_config", entity_id: null });
    const updated = await prisma.workingConfig.findFirst();
    res.status(200).json({ message: "Config updated", config: updated });
  } catch (error) {
    logger.error(`updateConfig failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const addSlot = async (req, res) => {
  const { slot_time, capacity } = req.body;
  if (!slot_time) return res.status(400).json({ message: "slot_time is required (HH:MM)" });
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1))
    return res.status(400).json({ message: "capacity must be a positive whole number" });

  try {
    const slot = await prisma.timeSlot.create({
      data: {
        slot_time: new Date(`1970-01-01T${slot_time}:00.000Z`),
        ...(capacity !== undefined ? { capacity } : {}),
      },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "time_slot", entity_id: slot.slot_id });
    res.status(201).json({ message: "Slot added", slot: { ...slot, slot_time: fmtTime(slot.slot_time) } });
  } catch (error) {
    if (error.code === "P2002") return res.status(400).json({ message: "Slot already exists" });
    logger.error(`addSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateSlot = async (req, res) => {
  const { id } = req.params;
  const { is_active, capacity } = req.body;
  if (is_active === undefined && capacity === undefined)
    return res.status(400).json({ message: "is_active and/or capacity must be provided" });
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1))
    return res.status(400).json({ message: "capacity must be a positive whole number" });

  try {
    const slot = await prisma.timeSlot.update({
      where: { slot_id: parseInt(id) },
      data: {
        ...(is_active !== undefined ? { is_active } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
      },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "SCHEDULE_UPDATED", entity_type: "time_slot", entity_id: slot.slot_id });
    res.status(200).json({ message: "Slot updated", slot: { ...slot, slot_time: fmtTime(slot.slot_time) } });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Slot not found" });
    logger.error(`updateSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteSlot = async (req, res) => {
  try {
    await prisma.timeSlot.delete({ where: { slot_id: parseInt(req.params.id) } });
    res.status(200).json({ message: "Slot deleted" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Slot not found" });
    if (error.code === "P2003")
      return res.status(400).json({ message: "Cannot delete a slot that has existing bookings" });
    logger.error(`deleteSlot failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getConfig, updateConfig, addSlot, updateSlot, deleteSlot };
