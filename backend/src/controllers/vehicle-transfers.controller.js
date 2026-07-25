const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");
const {
  VEHICLE_INCLUDE, flattenVehicle, UNRESOLVED_BOOKING_STATUSES, notifyPreviousOwner,
} = require("./vehicles.controller");

const CUSTOMER_ROLE_ID = 5;

const flattenDetachedVehicle = (v) => ({
  ...flattenVehicle(v),
  previous_owner: v.previous_customer
    ? {
        user_id: v.previous_customer.user_id,
        email: v.previous_customer.email,
        full_name: v.previous_customer.customer?.full_name ?? null,
      }
    : null,
});

const listDetachedVehicles = async (req, res) => {
  const { plate } = req.query;
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        customer_id: null,
        ...(plate ? { plate_no: { contains: plate.trim().toUpperCase() } } : {}),
      },
      include: {
        ...VEHICLE_INCLUDE,
        previous_customer: { select: { user_id: true, email: true, customer: { select: { full_name: true } } } },
      },
      orderBy: { detached_at: "desc" },
    });
    res.status(200).json({ vehicles: vehicles.map(flattenDetachedVehicle) });
  } catch (error) {
    logger.error(`listDetachedVehicles failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const forceTransferVehicle = async (req, res) => {
  const { user_id: staffUserId } = req.user;
  const { plate_no, new_owner_email } = req.body;
  if (!plate_no || !new_owner_email)
    return res.status(400).json({ message: "plate_no and new_owner_email are required" });

  const normalizedPlate = plate_no.trim().toUpperCase();
  const normalizedEmail = new_owner_email.trim().toLowerCase();

  try {
    const newOwner = await prisma.user.findFirst({
      where: { email: normalizedEmail, role_id: CUSTOMER_ROLE_ID },
      select: { user_id: true },
    });
    if (!newOwner) return res.status(404).json({ message: "No customer account found with that email" });

    const vehicle = await prisma.vehicle.findUnique({
      where: { plate_no: normalizedPlate },
      select: { vehicle_id: true, customer_id: true },
    });
    if (!vehicle) return res.status(404).json({ message: "No vehicle found with that plate number" });
    if (vehicle.customer_id === newOwner.user_id)
      return res.status(400).json({ message: "This vehicle is already assigned to that customer." });

    const unresolvedBookingCount = await prisma.reservation.count({
      where: { vehicle_id: vehicle.vehicle_id, status: UNRESOLVED_BOOKING_STATUSES },
    });
    if (unresolvedBookingCount > 0) {
      return res.status(400).json({
        message: "This vehicle has an upcoming or in-progress booking and cannot be transferred. Cancel or complete the booking first.",
      });
    }

    const oldCustomerId = vehicle.customer_id;
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { vehicle_id: vehicle.vehicle_id },
        data: { customer_id: newOwner.user_id, previous_customer_id: oldCustomerId, detached_at: null },
      });
      await logActivity(tx, {
        user_id: staffUserId,
        action: `VEHICLE_FORCE_TRANSFERRED (plate ${normalizedPlate}, from user ${oldCustomerId ?? "none"} to user ${newOwner.user_id})`,
        entity_type: "vehicle",
        entity_id: vehicle.vehicle_id,
      });
    });

    if (oldCustomerId) {
      notifyPreviousOwner(oldCustomerId, { plateNo: normalizedPlate, reason: "transferred" });
    }

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id }, include: VEHICLE_INCLUDE });
    res.status(200).json({ message: "Vehicle transferred successfully", vehicle: flattenVehicle(updated) });
  } catch (error) {
    logger.error(`forceTransferVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listDetachedVehicles, forceTransferVehicle };
