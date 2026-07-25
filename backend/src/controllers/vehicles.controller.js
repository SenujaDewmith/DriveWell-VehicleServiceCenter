const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");
const { sendVehicleTransferredEmail, sendTransferRequestNoticeEmail } = require("../services/email.service");
const { isValidPhone } = require("../lib/phone");

const VEHICLE_INCLUDE = {
  make: { select: { make_id: true, name: true } },
  model: { select: { model_id: true, name: true } },
  vehicle_type: { select: { type_id: true, name: true } },
};

// Bookings that aren't finished yet — these are the only ones that should
// block a detach/transfer. Completed/cancelled/no-show history never blocks.
const UNRESOLVED_BOOKING_STATUSES = { notIn: ["Cancelled", "No-show", "Completed"] };

const flattenVehicle = (v) => ({
  vehicle_id: v.vehicle_id,
  customer_id: v.customer_id,
  make_id: v.make_id,
  make: v.make?.name ?? v.custom_make,
  model_id: v.model_id,
  model: v.model?.name ?? v.custom_model,
  custom_make: v.custom_make,
  custom_model: v.custom_model,
  pending_catalog_review: v.model_id === null,
  vehicle_type_id: v.vehicle_type.type_id,
  vehicle_type: v.vehicle_type.name,
  year: v.year,
  plate_no: v.plate_no,
  created_at: v.created_at,
  detached_at: v.detached_at ?? null,
});

// Fire-and-forget notification to whoever owned the vehicle before this hand-off —
// never awaited by callers, mirrors every other email call site in this codebase.
const notifyPreviousOwner = async (previousCustomerId, { plateNo, reason }) => {
  if (!previousCustomerId) return;
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: previousCustomerId },
      select: { email: true, customer: { select: { full_name: true } } },
    });
    if (!user) return;
    sendVehicleTransferredEmail(user.email, { customerName: user.customer?.full_name, plateNo, reason });
  } catch (error) {
    logger.error(`notifyPreviousOwner failed — ${error.message}`);
  }
};

// Fire-and-forget notification to the CURRENT owner that someone has filed a
// transfer request against their vehicle — fraud-prevention: nothing has
// changed yet, but they shouldn't find out about a hand-off after the fact.
const notifyCurrentOwnerOfRequest = async (currentOwnerId, { plateNo }) => {
  if (!currentOwnerId) return;
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: currentOwnerId },
      select: { email: true, customer: { select: { full_name: true } } },
    });
    if (!user) return;
    sendTransferRequestNoticeEmail(user.email, { customerName: user.customer?.full_name, plateNo });
  } catch (error) {
    logger.error(`notifyCurrentOwnerOfRequest failed — ${error.message}`);
  }
};

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

const lookupPlate = async (req, res) => {
  const { user_id } = req.user;
  const plate_no = req.params.plate_no.trim().toUpperCase();

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plate_no },
      include: VEHICLE_INCLUDE,
    });
    if (!vehicle) return res.status(200).json({ found: false });
    if (vehicle.customer_id === user_id)
      return res.status(200).json({ found: true, status: "own", vehicle: flattenVehicle(vehicle) });
    if (vehicle.customer_id === null)
      return res.status(200).json({ found: true, status: "claimable", vehicle: flattenVehicle(vehicle) });
    // Owned by someone else — don't leak their vehicle's details through a lookup.
    return res.status(200).json({ found: true, status: "active_elsewhere" });
  } catch (error) {
    logger.error(`lookupPlate failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// Either an existing catalog id or a customer-typed custom value must be given for
// make and model (never both) — lets a customer register a vehicle whose make/model
// isn't in the catalog yet, pending a manager resolving it via the vehicle catalog admin.
const resolveMakeModelFields = ({ make_id, custom_make, model_id, custom_model }) => {
  if (!make_id && !custom_make) return { error: "make_id or custom_make is required" };
  if (make_id && custom_make) return { error: "Provide either make_id or custom_make, not both" };
  if (!model_id && !custom_model) return { error: "model_id or custom_model is required" };
  if (model_id && custom_model) return { error: "Provide either model_id or custom_model, not both" };
  if (custom_make && model_id) return { error: "A custom make cannot be paired with an existing model_id" };

  return {
    fields: {
      make_id: make_id ? parseInt(make_id) : null,
      custom_make: custom_make ? custom_make.trim() : null,
      model_id: model_id ? parseInt(model_id) : null,
      custom_model: custom_model ? custom_model.trim() : null,
    },
  };
};

const addVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { make_id, custom_make, model_id, custom_model, vehicle_type_id, year, plate_no } = req.body;

  if (!vehicle_type_id || !plate_no)
    return res.status(400).json({ message: "vehicle_type_id and plate_no are required" });
  const { fields, error } = resolveMakeModelFields({ make_id, custom_make, model_id, custom_model });
  if (error) return res.status(400).json({ message: error });

  try {
    const normalizedPlate = plate_no.trim().toUpperCase();
    const existing = await prisma.vehicle.findUnique({
      where: { plate_no: normalizedPlate },
      select: { customer_id: true },
    });
    if (existing && existing.customer_id === null) {
      return res.status(409).json({
        message: "A vehicle with this plate is already registered but currently unclaimed. Use Claim Vehicle to link it to your account instead.",
        claimable: true,
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        customer_id: user_id,
        ...fields,
        vehicle_type_id: parseInt(vehicle_type_id),
        year: year || null,
        plate_no: normalizedPlate,
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

const claimVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { plate_no } = req.body;
  if (!plate_no) return res.status(400).json({ message: "plate_no is required" });
  const normalizedPlate = plate_no.trim().toUpperCase();

  try {
    let claimedVehicleId = null;
    let previousCustomerId = null;

    await prisma.$transaction(async (tx) => {
      // Guarded conditional update — only succeeds if the plate is still
      // unclaimed at the moment of the write, closing the race window a
      // plain findFirst-then-update would leave open.
      const existingBeforeClaim = await tx.vehicle.findUnique({
        where: { plate_no: normalizedPlate },
        select: { vehicle_id: true, customer_id: true, previous_customer_id: true },
      });
      if (!existingBeforeClaim) {
        const err = new Error("No vehicle found with that plate number");
        err.status = 404;
        throw err;
      }

      const result = await tx.vehicle.updateMany({
        where: { plate_no: normalizedPlate, customer_id: null },
        data: { customer_id: user_id, detached_at: null },
      });

      if (result.count === 0) {
        const stillThere = await tx.vehicle.findUnique({
          where: { plate_no: normalizedPlate },
          select: { customer_id: true },
        });
        const err = new Error(
          stillThere && stillThere.customer_id !== null
            ? "This vehicle is already actively owned by another customer and cannot be claimed."
            : "This vehicle was just claimed by someone else. Please try again."
        );
        err.status = 409;
        throw err;
      }

      claimedVehicleId = existingBeforeClaim.vehicle_id;
      previousCustomerId = existingBeforeClaim.previous_customer_id;
      await logActivity(tx, { user_id, action: "VEHICLE_CLAIMED", entity_type: "vehicle", entity_id: claimedVehicleId });
    });

    const vehicle = await prisma.vehicle.findUnique({ where: { vehicle_id: claimedVehicleId }, include: VEHICLE_INCLUDE });
    notifyPreviousOwner(previousCustomerId, { plateNo: normalizedPlate, reason: "claimed" });
    res.status(200).json({ message: "Vehicle claimed successfully", vehicle: flattenVehicle(vehicle) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    logger.error(`claimVehicle failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const submitTransferRequest = async (req, res) => {
  const { user_id } = req.user;
  const { plate_no, contact_phone } = req.body;
  const logbookFile = req.files?.logbook_photo?.[0];
  const nicFile = req.files?.nic_photo?.[0];

  if (!plate_no) return res.status(400).json({ message: "plate_no is required" });
  if (!contact_phone || !isValidPhone(contact_phone))
    return res.status(400).json({ message: "A valid contact phone number is required" });
  if (!logbookFile || !nicFile)
    return res.status(400).json({ message: "Both a logbook photo and an NIC photo are required" });

  const normalizedPlate = plate_no.trim().toUpperCase();
  const normalizedPhone = contact_phone.trim();

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plate_no: normalizedPlate },
      select: { vehicle_id: true, customer_id: true },
    });
    if (!vehicle) return res.status(404).json({ message: "No vehicle found with that plate number" });
    if (vehicle.customer_id === null)
      return res.status(400).json({ message: "This vehicle is unclaimed — use Claim Vehicle instead." });
    if (vehicle.customer_id === user_id)
      return res.status(400).json({ message: "You already own this vehicle." });

    const existingPending = await prisma.vehicleTransferRequest.findFirst({
      where: { vehicle_id: vehicle.vehicle_id, status: "Pending" },
      select: { request_id: true },
    });
    if (existingPending) {
      return res.status(409).json({ message: "A transfer request for this vehicle is already awaiting review." });
    }

    const request = await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicle.vehicle_id,
        requester_id: user_id,
        current_owner_id: vehicle.customer_id,
        contact_phone: normalizedPhone,
        logbook_photo_path: logbookFile.filename,
        nic_photo_path: nicFile.filename,
      },
    });
    await logActivity(prisma, {
      user_id, action: "VEHICLE_TRANSFER_REQUESTED", entity_type: "vehicle_transfer_request", entity_id: request.request_id,
    });

    notifyCurrentOwnerOfRequest(vehicle.customer_id, { plateNo: normalizedPlate });

    // If this number isn't already on file, save it as a secondary contact
    // number so the customer doesn't have to retype it next time.
    let profileUpdated = false;
    const customer = await prisma.customer.findUnique({
      where: { user_id },
      select: { phone: true, secondary_phone: true },
    });
    if (customer && customer.phone !== normalizedPhone && customer.secondary_phone !== normalizedPhone) {
      await prisma.customer.update({ where: { user_id }, data: { secondary_phone: normalizedPhone } });
      profileUpdated = true;
    }

    res.status(201).json({
      message: "Transfer request submitted. You'll be notified once a manager reviews it.",
      request: { request_id: request.request_id, status: request.status },
      profile_updated: profileUpdated,
    });
  } catch (error) {
    logger.error(`submitTransferRequest failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listMyTransferRequests = async (req, res) => {
  const { user_id } = req.user;
  try {
    const requests = await prisma.vehicleTransferRequest.findMany({
      where: { requester_id: user_id },
      select: {
        request_id: true,
        status: true,
        rejection_reason: true,
        created_at: true,
        reviewed_at: true,
        vehicle: {
          select: {
            plate_no: true,
            custom_make: true,
            custom_model: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({
      requests: requests.map((r) => ({
        request_id: r.request_id,
        status: r.status,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        plate_no: r.vehicle.plate_no,
        // A vehicle pending catalog review has no make/model row yet — fall back to
        // the customer-typed value, same pattern as flattenVehicle above.
        make: r.vehicle.make?.name ?? r.vehicle.custom_make,
        model: r.vehicle.model?.name ?? r.vehicle.custom_model,
      })),
    });
  } catch (error) {
    logger.error(`listMyTransferRequests failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const { make_id, custom_make, model_id, custom_model, vehicle_type_id, year, plate_no } = req.body;

  if (!vehicle_type_id || !plate_no)
    return res.status(400).json({ message: "vehicle_type_id and plate_no are required" });
  const { fields, error } = resolveMakeModelFields({ make_id, custom_make, model_id, custom_model });
  if (error) return res.status(400).json({ message: error });

  try {
    const result = await prisma.vehicle.updateMany({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
      data: {
        ...fields,
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

const detachVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicle_id: parseInt(id), customer_id: user_id },
      select: { vehicle_id: true },
    });
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const unresolvedBookingCount = await prisma.reservation.count({
      where: { vehicle_id: parseInt(id), status: UNRESOLVED_BOOKING_STATUSES },
    });
    if (unresolvedBookingCount > 0) {
      return res.status(400).json({
        message: "This vehicle has an upcoming or in-progress booking and cannot be removed. Cancel or complete the booking first.",
      });
    }

    await prisma.vehicle.update({
      where: { vehicle_id: parseInt(id) },
      data: { customer_id: null, previous_customer_id: user_id, detached_at: new Date() },
    });
    await logActivity(prisma, { user_id, action: "VEHICLE_DETACHED", entity_type: "vehicle", entity_id: parseInt(id) });
    res.status(200).json({ message: "Vehicle removed from your account. You can restore it any time before someone else claims it." });
  } catch (error) {
    logger.error(`detachVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const listMyDetachedVehicles = async (req, res) => {
  const { user_id } = req.user;
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { customer_id: null, previous_customer_id: user_id },
      include: VEHICLE_INCLUDE,
      orderBy: { detached_at: "desc" },
    });
    res.status(200).json({ vehicles: vehicles.map(flattenVehicle) });
  } catch (error) {
    logger.error(`listMyDetachedVehicles failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const restoreVehicle = async (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const vehicleId = parseInt(id);

  try {
    const result = await prisma.vehicle.updateMany({
      where: { vehicle_id: vehicleId, customer_id: null, previous_customer_id: user_id },
      data: { customer_id: user_id, previous_customer_id: null, detached_at: null },
    });

    if (result.count === 0) {
      const existing = await prisma.vehicle.findUnique({
        where: { vehicle_id: vehicleId },
        select: { customer_id: true, previous_customer_id: true },
      });
      if (!existing) return res.status(404).json({ message: "Vehicle not found" });
      if (existing.customer_id !== null)
        return res.status(409).json({ message: "This vehicle has already been claimed by another customer and can no longer be restored." });
      return res.status(403).json({ message: "You are not authorized to restore this vehicle." });
    }

    await logActivity(prisma, { user_id, action: "VEHICLE_RESTORED", entity_type: "vehicle", entity_id: vehicleId });
    const vehicle = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicleId }, include: VEHICLE_INCLUDE });
    res.status(200).json({ message: "Vehicle restored", vehicle: flattenVehicle(vehicle) });
  } catch (error) {
    logger.error(`restoreVehicle failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listVehicles, addVehicle, updateVehicle, detachVehicle,
  lookupPlate, claimVehicle, listMyDetachedVehicles, restoreVehicle,
  submitTransferRequest, listMyTransferRequests,
  listMakes, listModels, listVehicleTypes,
  VEHICLE_INCLUDE, flattenVehicle, UNRESOLVED_BOOKING_STATUSES, notifyPreviousOwner,
};
