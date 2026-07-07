const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

const listVehicles = async (req, res) => {
  const { user_id } = req.user;
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { customer_id: user_id },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ vehicles });
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
    const vehicle = await prisma.vehicle.create({
      data: {
        customer_id: user_id,
        make: make.trim(),
        model: model.trim(),
        year: year || null,
        plate_no: plate_no.trim().toUpperCase(),
        color: color || null,
      },
    });
    logger.info(`Vehicle added — vehicle_id: ${vehicle.vehicle_id}, user_id: ${user_id}`);
    res.status(201).json({ message: "Vehicle added", vehicle });
  } catch (error) {
    if (error.code === "P2002")
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
    const vehicle = await prisma.vehicle.updateMany({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
      data: {
        make: make.trim(),
        model: model.trim(),
        year: year || null,
        plate_no: plate_no.trim().toUpperCase(),
        color: color || null,
      },
    });
    if (vehicle.count === 0) return res.status(404).json({ message: "Vehicle not found" });

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: parseInt(id) } });
    res.status(200).json({ message: "Vehicle updated", vehicle: updated });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "Plate number already registered" });
    logger.error(`updateVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;

  try {
    const result = await prisma.vehicle.deleteMany({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
    });
    if (result.count === 0) return res.status(404).json({ message: "Vehicle not found" });

    res.status(200).json({ message: "Vehicle deleted" });
  } catch (error) {
    if (error.code === "P2003")
      return res.status(400).json({ message: "Cannot delete vehicle with existing bookings" });
    logger.error(`deleteVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listVehicles, addVehicle, updateVehicle, deleteVehicle };
