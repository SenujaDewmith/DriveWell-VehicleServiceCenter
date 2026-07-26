const fs = require("fs");
const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { TRANSFER_DOCS_DIR } = require("../src/middlewares/upload.middleware");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { createReservation } = require("./helpers/booking");

const TOYOTA_MAKE_ID = 1;
const VITZ_MODEL_ID = 51; // Toyota Vitz, vehicle_type_id 1 (Car)
const CAR_TYPE_ID = 1;

async function customerSession(overrides) {
  const customer = await createUser("Customer", overrides);
  const agent = request.agent(app);
  await loginAs(agent, customer, "customer");
  return { agent, customer };
}

async function managerSession(overrides) {
  const manager = await createUser("Service Center Manager", overrides);
  const agent = request.agent(app);
  await loginAs(agent, manager, "staff");
  return { agent, manager };
}

async function createVehicle(customerId, overrides = {}) {
  return prisma.vehicle.create({
    data: {
      customer_id: overrides.customer_id !== undefined ? overrides.customer_id : customerId,
      previous_customer_id: overrides.previous_customer_id,
      make_id: overrides.make_id !== undefined ? overrides.make_id : TOYOTA_MAKE_ID,
      model_id: overrides.model_id !== undefined ? overrides.model_id : VITZ_MODEL_ID,
      vehicle_type_id: overrides.vehicle_type_id ?? CAR_TYPE_ID,
      year: overrides.year ?? 2020,
      plate_no: overrides.plate_no,
      detached_at: overrides.detached_at,
    },
  });
}

// Writes a real (tiny) file to TRANSFER_DOCS_DIR so getTransferRequestDocument
// has something to res.sendFile — its content is never inspected.
function writeFakeDoc(filename) {
  fs.writeFileSync(`${TRANSFER_DOCS_DIR}/${filename}`, Buffer.from("fake-image-bytes"));
}

async function createTransferRequest({ vehicle, requesterId, currentOwnerId, status = "Pending", withDocs = true }) {
  const logbook_photo_path = withDocs ? `test-logbook-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg` : null;
  const nic_photo_path = withDocs ? `test-nic-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg` : null;
  if (withDocs) {
    writeFakeDoc(logbook_photo_path);
    writeFakeDoc(nic_photo_path);
  }
  return prisma.vehicleTransferRequest.create({
    data: {
      vehicle_id: vehicle.vehicle_id,
      requester_id: requesterId,
      current_owner_id: currentOwnerId,
      contact_phone: "0771234567",
      status,
      logbook_photo_path,
      nic_photo_path,
    },
  });
}

beforeEach(async () => {
  await resetTransactionalTables();
});

describe("GET /api/admin/vehicles/detached", () => {
  test("lists detached vehicles across every customer with previous-owner info", async () => {
    const { agent } = await managerSession();
    const previousOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "DET-A001", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.get("/api/admin/vehicles/detached").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0].previous_owner.email).toBe(previousOwner.email);
  });

  test("filters by plate", async () => {
    const { agent } = await managerSession();
    const previousOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "DET-A002", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });
    await createVehicle(null, { plate_no: "OTHER-999", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.get("/api/admin/vehicles/detached?plate=DET-A").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0].plate_no).toBe("DET-A002");
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicles/detached").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicles/detached").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicles/force-transfer", () => {
  test("transfers an actively-owned vehicle to a new customer by plate + email", async () => {
    const { agent } = await managerSession();
    const oldOwner = await createUser("Customer");
    const newOwner = await createUser("Customer");
    const vehicle = await createVehicle(oldOwner.user_id, { plate_no: "FTR-0001" });

    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0001", new_owner_email: newOwner.email,
    });
    expect(res.status).toBe(200);
    expect(res.body.vehicle.customer_id).toBe(newOwner.user_id);

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(updated.customer_id).toBe(newOwner.user_id);
    expect(updated.previous_customer_id).toBe(oldOwner.user_id);
  });

  test("transfers a currently-detached vehicle to a new customer", async () => {
    const { agent } = await managerSession();
    const previousOwner = await createUser("Customer");
    const newOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "FTR-0002", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0002", new_owner_email: newOwner.email,
    });
    expect(res.status).toBe(200);
    expect(res.body.vehicle.customer_id).toBe(newOwner.user_id);
  });

  test("finds the new owner by email regardless of casing (regression: emails are stored lowercase)", async () => {
    const { agent } = await managerSession();
    const oldOwner = await createUser("Customer");
    const vehicle = await createVehicle(oldOwner.user_id, { plate_no: "FTR-0006" });

    // Registers through the real endpoint (not the createUser test helper) so the email is
    // actually stored the way a real signup would store it — lowercased by auth.schema.js.
    const registered = await request(app).post("/api/auth/register").send({
      name: "Case Test",
      email: "Case.Test@Example.com",
      password: "Password@123",
    });
    expect(registered.status).toBe(201);

    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0006", new_owner_email: "CASE.TEST@EXAMPLE.COM",
    });
    expect(res.status).toBe(200);
    expect(res.body.vehicle.customer_id).toBe(registered.body.user.user_id);
  });

  test("400 when plate_no or new_owner_email missing", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({ plate_no: "X" });
    expect(res.status).toBe(400);
  });

  test("404 when no customer account exists with that email", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "FTR-0003" });
    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0003", new_owner_email: "nobody@test.local",
    });
    expect(res.status).toBe(404);
  });

  test("404 when no vehicle exists with that plate", async () => {
    const { agent } = await managerSession();
    const newOwner = await createUser("Customer");
    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "NOPE-0001", new_owner_email: newOwner.email,
    });
    expect(res.status).toBe(404);
  });

  test("400 when the vehicle is already assigned to that customer", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "FTR-0004" });
    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0004", new_owner_email: owner.email,
    });
    expect(res.status).toBe(400);
  });

  test("400 when the vehicle has an upcoming/in-progress booking", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const newOwner = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "FTR-0005" });
    const pkg = await seedPackage();
    await createReservation({ customerId: owner.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, estimatedDuration: pkg.estimated_duration });

    const res = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({
      plate_no: "FTR-0005", new_owner_email: newOwner.email,
    });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicles/force-transfer").set("X-Portal", "staff").send({});
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicles/force-transfer").set("X-Portal", "customer").send({});
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/admin/vehicles/transfer-requests", () => {
  test("lists all transfer requests with requester/current-owner info", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "LST-0001" });
    await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const res = await agent.get("/api/admin/vehicles/transfer-requests").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].requester.email).toBe(requester.email);
    expect(res.body.requests[0].current_owner.email).toBe(owner.email);
    expect(res.body.requests[0].vehicle.plate_no).toBe("LST-0001");
  });

  test("filters by status", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requesterA = await createUser("Customer");
    const requesterB = await createUser("Customer");
    const vehicleA = await createVehicle(owner.user_id, { plate_no: "LST-0002" });
    const vehicleB = await createVehicle(owner.user_id, { plate_no: "LST-0003" });
    await createTransferRequest({ vehicle: vehicleA, requesterId: requesterA.user_id, currentOwnerId: owner.user_id, status: "Pending" });
    await createTransferRequest({ vehicle: vehicleB, requesterId: requesterB.user_id, currentOwnerId: owner.user_id, status: "Rejected", withDocs: false });

    const res = await agent.get("/api/admin/vehicles/transfer-requests?status=Rejected").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].status).toBe("Rejected");
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicles/transfer-requests").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicles/transfer-requests").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/admin/vehicles/transfer-requests/:id/documents/:type", () => {
  test("streams the logbook and nic photos for a manager", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "DOC-0001" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const logbookRes = await agent.get(`/api/admin/vehicles/transfer-requests/${req_.request_id}/documents/logbook`).set("X-Portal", "staff");
    expect(logbookRes.status).toBe(200);
    const nicRes = await agent.get(`/api/admin/vehicles/transfer-requests/${req_.request_id}/documents/nic`).set("X-Portal", "staff");
    expect(nicRes.status).toBe(200);
  });

  test("400 for an invalid document type", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "DOC-0002" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const res = await agent.get(`/api/admin/vehicles/transfer-requests/${req_.request_id}/documents/passport`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
  });

  test("404 when the request doesn't exist", async () => {
    const { agent } = await managerSession();
    const res = await agent.get("/api/admin/vehicles/transfer-requests/999999/documents/logbook").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("404 when the request has already been resolved (documents purged)", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "DOC-0003" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id, status: "Rejected", withDocs: false });

    const res = await agent.get(`/api/admin/vehicles/transfer-requests/${req_.request_id}/documents/logbook`).set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicles/transfer-requests/1/documents/logbook").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicles/transfer-requests/1/documents/logbook").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicles/transfer-requests/:id/approve", () => {
  test("approves a pending request and transfers ownership to the requester", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "APR-0001" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const res = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/approve`).set("X-Portal", "staff");
    expect(res.status).toBe(200);

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(updatedVehicle.customer_id).toBe(requester.user_id);
    expect(updatedVehicle.previous_customer_id).toBe(owner.user_id);

    const updatedRequest = await prisma.vehicleTransferRequest.findUnique({ where: { request_id: req_.request_id } });
    expect(updatedRequest.status).toBe("Approved");
    expect(updatedRequest.logbook_photo_path).toBeNull();
    expect(updatedRequest.nic_photo_path).toBeNull();
  });

  test("404 when the request doesn't exist", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicles/transfer-requests/999999/approve").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("409 when the request has already been resolved", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "APR-0002" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const first = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/approve`).set("X-Portal", "staff");
    expect(first.status).toBe(200);

    const second = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/approve`).set("X-Portal", "staff");
    expect(second.status).toBe(409);
  });

  test("409 when the vehicle's ownership changed since the request was filed", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const somebodyElse = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "APR-0003" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    // Ownership changes out from under the request (e.g. owner detached, someone else claimed it).
    await prisma.vehicle.update({ where: { vehicle_id: vehicle.vehicle_id }, data: { customer_id: somebodyElse.user_id } });

    const res = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/approve`).set("X-Portal", "staff");
    expect(res.status).toBe(409);
  });

  test("400 when the vehicle has an upcoming/in-progress booking", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "APR-0004" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });
    const pkg = await seedPackage();
    await createReservation({ customerId: owner.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, estimatedDuration: pkg.estimated_duration });

    const res = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/approve`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicles/transfer-requests/1/approve").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicles/transfer-requests/1/approve").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicles/transfer-requests/:id/reject", () => {
  test("rejects a pending request with a reason, purging its documents", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "REJ-0001" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const res = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/reject`).set("X-Portal", "staff").send({ reason: "Documents illegible" });
    expect(res.status).toBe(200);

    const updatedRequest = await prisma.vehicleTransferRequest.findUnique({ where: { request_id: req_.request_id } });
    expect(updatedRequest.status).toBe("Rejected");
    expect(updatedRequest.rejection_reason).toBe("Documents illegible");
    expect(updatedRequest.logbook_photo_path).toBeNull();

    // Ownership must not have changed.
    const unchangedVehicle = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(unchangedVehicle.customer_id).toBe(owner.user_id);
  });

  test("404 when the request doesn't exist", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicles/transfer-requests/999999/reject").set("X-Portal", "staff").send({});
    expect(res.status).toBe(404);
  });

  test("409 when the request has already been resolved", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const requester = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "REJ-0002" });
    const req_ = await createTransferRequest({ vehicle, requesterId: requester.user_id, currentOwnerId: owner.user_id });

    const first = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/reject`).set("X-Portal", "staff").send({});
    expect(first.status).toBe(200);
    const second = await agent.post(`/api/admin/vehicles/transfer-requests/${req_.request_id}/reject`).set("X-Portal", "staff").send({});
    expect(second.status).toBe(409);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicles/transfer-requests/1/reject").set("X-Portal", "staff").send({});
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicles/transfer-requests/1/reject").set("X-Portal", "customer").send({});
    expect(wrongRole.status).toBe(403);
  });
});
