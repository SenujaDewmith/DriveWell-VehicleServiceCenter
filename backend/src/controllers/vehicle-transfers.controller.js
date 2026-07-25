const fs = require("fs");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");
const { TRANSFER_DOCS_DIR } = require("../middlewares/upload.middleware");
const { sendTransferRequestDecisionEmail } = require("../services/email.service");
const {
  VEHICLE_INCLUDE, flattenVehicle, UNRESOLVED_BOOKING_STATUSES, notifyPreviousOwner,
} = require("./vehicles.controller");

const CUSTOMER_ROLE_ID = 5;

// Shared ownership hand-off — used by both the direct staff force-transfer and
// approving a customer-submitted transfer request, so the actual DB mutation +
// audit log only exists in one place.
const performOwnershipTransfer = async (tx, { vehicleId, newOwnerId, oldOwnerId, actorUserId, action }) => {
  await tx.vehicle.update({
    where: { vehicle_id: vehicleId },
    data: { customer_id: newOwnerId, previous_customer_id: oldOwnerId, detached_at: null },
  });
  await logActivity(tx, {
    user_id: actorUserId,
    action: `${action} (vehicle ${vehicleId}, from user ${oldOwnerId ?? "none"} to user ${newOwnerId})`,
    entity_type: "vehicle",
    entity_id: vehicleId,
  });
};

// Best-effort cleanup — transfer-request evidence photos are PII (an ID
// document) and shouldn't outlive the request they were submitted for.
const deleteTransferDocs = (...filenames) => {
  for (const filename of filenames) {
    if (!filename) continue;
    fs.unlink(`${TRANSFER_DOCS_DIR}/${filename}`, (err) => {
      if (err && err.code !== "ENOENT") logger.error(`Failed to delete transfer document ${filename} — ${err.message}`);
    });
  }
};

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
    await prisma.$transaction((tx) =>
      performOwnershipTransfer(tx, {
        vehicleId: vehicle.vehicle_id,
        newOwnerId: newOwner.user_id,
        oldOwnerId: oldCustomerId,
        actorUserId: staffUserId,
        action: "VEHICLE_FORCE_TRANSFERRED",
      })
    );

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

const listTransferRequests = async (req, res) => {
  const { status } = req.query;
  try {
    const requests = await prisma.vehicleTransferRequest.findMany({
      where: status ? { status } : {},
      include: {
        vehicle: { include: VEHICLE_INCLUDE },
        requester: { select: { user_id: true, email: true, customer: { select: { full_name: true } } } },
      },
      orderBy: { created_at: "desc" },
    });

    // current_owner_id is a plain snapshot column (no relation) — batch-fetch
    // the users it points to instead of an include.
    const ownerIds = [...new Set(requests.map((r) => r.current_owner_id).filter(Boolean))];
    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { user_id: { in: ownerIds } },
          select: { user_id: true, email: true, customer: { select: { full_name: true } } },
        })
      : [];
    const ownerById = new Map(owners.map((o) => [o.user_id, o]));

    res.status(200).json({
      requests: requests.map((r) => {
        const owner = r.current_owner_id ? ownerById.get(r.current_owner_id) : null;
        return {
          request_id: r.request_id,
          status: r.status,
          contact_phone: r.contact_phone,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
          rejection_reason: r.rejection_reason,
          vehicle: flattenVehicle(r.vehicle),
          requester: {
            user_id: r.requester.user_id,
            email: r.requester.email,
            full_name: r.requester.customer?.full_name ?? null,
          },
          current_owner: owner
            ? { user_id: owner.user_id, email: owner.email, full_name: owner.customer?.full_name ?? null }
            : null,
        };
      }),
    });
  } catch (error) {
    logger.error(`listTransferRequests failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getTransferRequestDocument = async (req, res) => {
  const { id, type } = req.params;
  if (!["logbook", "nic"].includes(type)) return res.status(400).json({ message: "Invalid document type" });

  try {
    const request = await prisma.vehicleTransferRequest.findUnique({
      where: { request_id: parseInt(id) },
      select: { logbook_photo_path: true, nic_photo_path: true },
    });
    if (!request) return res.status(404).json({ message: "Transfer request not found" });

    const filename = type === "logbook" ? request.logbook_photo_path : request.nic_photo_path;
    if (!filename) return res.status(404).json({ message: "Document not available (request already resolved)" });

    // root option keeps this scoped to TRANSFER_DOCS_DIR regardless of filename content.
    res.sendFile(filename, { root: TRANSFER_DOCS_DIR }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: "Document not found" });
    });
  } catch (error) {
    logger.error(`getTransferRequestDocument failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const approveTransferRequest = async (req, res) => {
  const { user_id: staffUserId } = req.user;
  const requestId = parseInt(req.params.id);

  try {
    const request = await prisma.vehicleTransferRequest.findUnique({ where: { request_id: requestId } });
    if (!request) return res.status(404).json({ message: "Transfer request not found" });
    if (request.status !== "Pending")
      return res.status(409).json({ message: `This request has already been ${request.status.toLowerCase()}.` });

    const vehicle = await prisma.vehicle.findUnique({
      where: { vehicle_id: request.vehicle_id },
      select: { vehicle_id: true, customer_id: true, plate_no: true },
    });
    if (!vehicle) return res.status(404).json({ message: "Vehicle no longer exists" });

    // Ownership may have changed since the request was filed (e.g. the old owner
    // detached it themselves, or another request was already approved) — don't
    // blindly transfer against stale evidence.
    if (vehicle.customer_id !== request.current_owner_id) {
      return res.status(409).json({
        message: "This vehicle's ownership has changed since this request was filed. Reject this request and ask the customer to resubmit if still needed.",
      });
    }
    if (vehicle.customer_id === request.requester_id)
      return res.status(400).json({ message: "The requester already owns this vehicle." });

    const unresolvedBookingCount = await prisma.reservation.count({
      where: { vehicle_id: vehicle.vehicle_id, status: UNRESOLVED_BOOKING_STATUSES },
    });
    if (unresolvedBookingCount > 0) {
      return res.status(400).json({
        message: "This vehicle has an upcoming or in-progress booking and cannot be transferred. Cancel or complete the booking first.",
      });
    }

    const oldOwnerId = vehicle.customer_id;
    await prisma.$transaction(async (tx) => {
      await performOwnershipTransfer(tx, {
        vehicleId: vehicle.vehicle_id,
        newOwnerId: request.requester_id,
        oldOwnerId,
        actorUserId: staffUserId,
        action: "VEHICLE_TRANSFER_REQUEST_APPROVED",
      });
      await tx.vehicleTransferRequest.update({
        where: { request_id: requestId },
        data: {
          status: "Approved",
          reviewer_id: staffUserId,
          reviewed_at: new Date(),
          logbook_photo_path: null,
          nic_photo_path: null,
        },
      });
    });

    deleteTransferDocs(request.logbook_photo_path, request.nic_photo_path);

    if (oldOwnerId) notifyPreviousOwner(oldOwnerId, { plateNo: vehicle.plate_no, reason: "transferred" });

    const requester = await prisma.user.findUnique({
      where: { user_id: request.requester_id },
      select: { email: true, customer: { select: { full_name: true } } },
    });
    if (requester) {
      sendTransferRequestDecisionEmail(requester.email, {
        customerName: requester.customer?.full_name, plateNo: vehicle.plate_no, approved: true,
      });
    }

    res.status(200).json({ message: "Transfer request approved and vehicle transferred" });
  } catch (error) {
    logger.error(`approveTransferRequest failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const rejectTransferRequest = async (req, res) => {
  const { user_id: staffUserId } = req.user;
  const requestId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const request = await prisma.vehicleTransferRequest.findUnique({ where: { request_id: requestId } });
    if (!request) return res.status(404).json({ message: "Transfer request not found" });
    if (request.status !== "Pending")
      return res.status(409).json({ message: `This request has already been ${request.status.toLowerCase()}.` });

    await prisma.$transaction(async (tx) => {
      await tx.vehicleTransferRequest.update({
        where: { request_id: requestId },
        data: {
          status: "Rejected",
          reviewer_id: staffUserId,
          reviewed_at: new Date(),
          rejection_reason: reason || null,
          logbook_photo_path: null,
          nic_photo_path: null,
        },
      });
      await logActivity(tx, {
        user_id: staffUserId, action: "VEHICLE_TRANSFER_REQUEST_REJECTED", entity_type: "vehicle_transfer_request", entity_id: requestId,
      });
    });

    deleteTransferDocs(request.logbook_photo_path, request.nic_photo_path);

    const [requester, vehicle] = await Promise.all([
      prisma.user.findUnique({ where: { user_id: request.requester_id }, select: { email: true, customer: { select: { full_name: true } } } }),
      prisma.vehicle.findUnique({ where: { vehicle_id: request.vehicle_id }, select: { plate_no: true } }),
    ]);
    if (requester) {
      sendTransferRequestDecisionEmail(requester.email, {
        customerName: requester.customer?.full_name, plateNo: vehicle?.plate_no ?? "", approved: false, reason,
      });
    }

    res.status(200).json({ message: "Transfer request rejected" });
  } catch (error) {
    logger.error(`rejectTransferRequest failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listDetachedVehicles, forceTransferVehicle,
  listTransferRequests, getTransferRequestDocument, approveTransferRequest, rejectTransferRequest,
};
