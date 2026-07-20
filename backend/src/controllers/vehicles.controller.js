const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

const VEHICLE_INCLUDE = {
  make: { select: { make_id: true, name: true } },
  model: { select: { model_id: true, name: true } },
  vehicle_type: { select: { type_id: true, name: true } },
};

const flattenVehicle = (v) => ({
  vehicle_id: v.vehicle_id,
  customer_id: v.customer_id,
  make_id: v.make.make_id,
  make: v.make.name,
  model_id: v.model.model_id,
  model: v.model.name,
  vehicle_type_id: v.vehicle_type.type_id,
  vehicle_type: v.vehicle_type.name,
  year: v.year,
  plate_no: v.plate_no,
  created_at: v.created_at,
});

const listVehicles = async (req, res) => {
  const { user_id } = req.user;
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { customer_id: user_id },
      include: VEHICLE_INCLUDE,
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ vehicles: vehicles.map(flattenVehicle) });
  } catch (error) {
    logger.error(`listVehicles failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listMakes = async (req, res) => {
  try {
    const makes = await prisma.vehicleMake.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ makes });
  } catch (error) {
    logger.error(`listMakes failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listModels = async (req, res) => {
  const { make_id } = req.query;
  try {
    const models = await prisma.vehicleModel.findMany({
      where: make_id ? { make_id: parseInt(make_id) } : {},
      orderBy: { name: "asc" },
    });
    res.status(200).json({ models });
  } catch (error) {
    logger.error(`listModels failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const HIDDEN_VEHICLE_TYPES = ["Motorcycle", "Three-Wheeler"];

const listVehicleTypes = async (req, res) => {
  try {
    const types = await prisma.vehicleType.findMany({
      where: { name: { notIn: HIDDEN_VEHICLE_TYPES } },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ types });
  } catch (error) {
    logger.error(`listVehicleTypes failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const addVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { make_id, model_id, vehicle_type_id, year, plate_no } = req.body;

  if (!make_id || !model_id || !vehicle_type_id || !plate_no)
    return res.status(400).json({ message: "make_id, model_id, vehicle_type_id, and plate_no are required" });

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        customer_id: user_id,
        make_id: parseInt(make_id),
        model_id: parseInt(model_id),
        vehicle_type_id: parseInt(vehicle_type_id),
        year: year || null,
        plate_no: plate_no.trim().toUpperCase(),
      },
      include: VEHICLE_INCLUDE,
    });
    logger.info(`Vehicle added — vehicle_id: ${vehicle.vehicle_id}, user_id: ${user_id}`);
    res.status(201).json({ message: "Vehicle added", vehicle: flattenVehicle(vehicle) });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "Plate number already registered" });
    if (error.code === "P2003")
      return res.status(400).json({ message: "Invalid make, model, or vehicle type" });
    logger.error(`addVehicle failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const { make_id, model_id, vehicle_type_id, year, plate_no } = req.body;

  if (!make_id || !model_id || !vehicle_type_id || !plate_no)
    return res.status(400).json({ message: "make_id, model_id, vehicle_type_id, and plate_no are required" });

  try {
    const result = await prisma.vehicle.updateMany({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
      data: {
        make_id: parseInt(make_id),
        model_id: parseInt(model_id),
        vehicle_type_id: parseInt(vehicle_type_id),
        year: year || null,
        plate_no: plate_no.trim().toUpperCase(),
      },
    });
    if (result.count === 0) return res.status(404).json({ message: "Vehicle not found" });

    const updated = await prisma.vehicle.findUnique({
      where: { vehicle_id: parseInt(id) },
      include: VEHICLE_INCLUDE,
    });
    res.status(200).json({ message: "Vehicle updated", vehicle: flattenVehicle(updated) });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "Plate number already registered" });
    if (error.code === "P2003")
      return res.status(400).json({ message: "Invalid make, model, or vehicle type" });
    logger.error(`updateVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
      select: { vehicle_id: true },
    });
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const bookingCount = await prisma.reservation.count({
      where: { vehicle_id: parseInt(id) },
    });
    if (bookingCount > 0) {
      return res.status(400).json({
        message: "This vehicle has booking history and cannot be deleted. Vehicles with past or active bookings are kept for service and invoice records.",
      });
    }

    await prisma.vehicle.delete({ where: { vehicle_id: parseInt(id) } });
    res.status(200).json({ message: "Vehicle deleted" });
  } catch (error) {
    logger.error(`deleteVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listVehicles, addVehicle, updateVehicle, deleteVehicle,
  listMakes, listModels, listVehicleTypes,
};
