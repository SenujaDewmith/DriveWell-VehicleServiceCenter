const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { createReservation } = require("./helpers/booking");

// From backend/prisma/seed-data — real catalog rows loaded once by globalSetup.
const TOYOTA_MAKE_ID = 1;
const VITZ_MODEL_ID = 51; // Toyota Vitz, vehicle_type_id 1 (Car)
const PRADO_MODEL_ID = 54; // Toyota Land Cruiser Prado, vehicle_type_id 2 (SUV)
const CAR_TYPE_ID = 1;
const SUV_TYPE_ID = 2;

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
      custom_make: overrides.custom_make,
      custom_model: overrides.custom_model,
      vehicle_type_id: overrides.vehicle_type_id ?? CAR_TYPE_ID,
      year: overrides.year ?? 2020,
      plate_no: overrides.plate_no,
      detached_at: overrides.detached_at,
    },
  });
}

beforeEach(async () => {
  await resetTransactionalTables();
});

describe("GET /api/vehicles", () => {
  test("lists only vehicles belonging to the authenticated customer", async () => {
    const { agent, customer } = await customerSession();
    const other = await createUser("Customer");
    await createVehicle(customer.user_id, { plate_no: "CAA-1234" });
    await createVehicle(other.user_id, { plate_no: "CAB-5678" });

    const res = await agent.get("/api/vehicles").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0]).toMatchObject({
      plate_no: "CAA-1234",
      make: "Toyota",
      model: "Vitz",
      vehicle_type: "Car",
      pending_catalog_review: false,
    });
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);

    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/makes", () => {
  test("lists all catalog makes", async () => {
    const { agent } = await customerSession();
    const res = await agent.get("/api/vehicles/makes").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.makes.map((m) => m.name)).toContain("Toyota");
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/makes").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/makes").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/models", () => {
  test("lists all models when unfiltered, filters by make_id", async () => {
    const { agent } = await customerSession();
    const all = await agent.get("/api/vehicles/models").set("X-Portal", "customer");
    expect(all.status).toBe(200);
    expect(all.body.models.length).toBeGreaterThan(1);

    const filtered = await agent.get(`/api/vehicles/models?make_id=${TOYOTA_MAKE_ID}`).set("X-Portal", "customer");
    expect(filtered.status).toBe(200);
    expect(filtered.body.models.every((m) => m.make_id === TOYOTA_MAKE_ID)).toBe(true);
    expect(filtered.body.models.map((m) => m.model_id)).toContain(VITZ_MODEL_ID);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/models").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/models").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/types", () => {
  test("hides Motorcycle and Three-Wheeler from the customer-facing list", async () => {
    const { agent } = await customerSession();
    const res = await agent.get("/api/vehicles/types").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    const names = res.body.types.map((t) => t.name);
    expect(names).toContain("Car");
    expect(names).not.toContain("Motorcycle");
    expect(names).not.toContain("Three-Wheeler");
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/types").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/types").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/detached", () => {
  test("lists the customer's own detached vehicles, not other customers'", async () => {
    const { agent, customer } = await customerSession();
    const other = await createUser("Customer");
    await createVehicle(null, { plate_no: "DET-0001", customer_id: null, previous_customer_id: customer.user_id, detached_at: new Date() });
    await createVehicle(null, { plate_no: "DET-0002", customer_id: null, previous_customer_id: other.user_id, detached_at: new Date() });

    const res = await agent.get("/api/vehicles/detached").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0].plate_no).toBe("DET-0001");
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/detached").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/detached").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/lookup/:plate_no", () => {
  test("unregistered plate -> found: false", async () => {
    const { agent } = await customerSession();
    const res = await agent.get("/api/vehicles/lookup/ZZZ-9999").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });

  test("own vehicle -> status own with full data", async () => {
    const { agent, customer } = await customerSession();
    await createVehicle(customer.user_id, { plate_no: "OWN-0001" });
    const res = await agent.get("/api/vehicles/lookup/OWN-0001").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.status).toBe("own");
    expect(res.body.vehicle.plate_no).toBe("OWN-0001");
  });

  test("detached vehicle -> status claimable", async () => {
    const { agent } = await customerSession();
    const previousOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "CLM-0001", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });
    const res = await agent.get("/api/vehicles/lookup/CLM-0001").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("claimable");
    expect(res.body.vehicle.plate_no).toBe("CLM-0001");
  });

  test("vehicle actively owned by someone else -> status active_elsewhere, no leaked vehicle data", async () => {
    const { agent } = await customerSession();
    const otherOwner = await createUser("Customer");
    await createVehicle(otherOwner.user_id, { plate_no: "OTH-0001" });
    const res = await agent.get("/api/vehicles/lookup/OTH-0001").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active_elsewhere");
    expect(res.body.vehicle).toBeUndefined();
  });

  test("plate lookup is case/whitespace normalized", async () => {
    const { agent, customer } = await customerSession();
    await createVehicle(customer.user_id, { plate_no: "NORM-0001" });
    const res = await agent.get("/api/vehicles/lookup/ norm-0001 ".trim()).set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("own");
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/lookup/AAA-0000").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/lookup/AAA-0000").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/vehicles/claim", () => {
  test("claims a currently-detached vehicle", async () => {
    const { agent, customer } = await customerSession();
    const previousOwner = await createUser("Customer");
    const vehicle = await createVehicle(null, { plate_no: "CLM-0002", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.post("/api/vehicles/claim").set("X-Portal", "customer").send({ plate_no: "clm-0002" });
    expect(res.status).toBe(200);
    expect(res.body.vehicle.plate_no).toBe("CLM-0002");

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(updated.customer_id).toBe(customer.user_id);
    expect(updated.detached_at).toBeNull();
  });

  test("400 when plate_no missing", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles/claim").set("X-Portal", "customer").send({});
    expect(res.status).toBe(400);
  });

  test("404 when no vehicle exists with that plate", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles/claim").set("X-Portal", "customer").send({ plate_no: "NOPE-0001" });
    expect(res.status).toBe(404);
  });

  test("409 when the vehicle is actively owned by someone else", async () => {
    const { agent } = await customerSession();
    const otherOwner = await createUser("Customer");
    await createVehicle(otherOwner.user_id, { plate_no: "ACT-0001" });
    const res = await agent.post("/api/vehicles/claim").set("X-Portal", "customer").send({ plate_no: "ACT-0001" });
    expect(res.status).toBe(409);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).post("/api/vehicles/claim").set("X-Portal", "customer").send({ plate_no: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.post("/api/vehicles/claim").set("X-Portal", "staff").send({ plate_no: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("GET /api/vehicles/transfer-requests/mine", () => {
  test("lists the requester's own transfer requests", async () => {
    const { agent, customer } = await customerSession();
    const owner = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "MINE-0001" });
    await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicle.vehicle_id,
        requester_id: customer.user_id,
        current_owner_id: owner.user_id,
        contact_phone: "0771234567",
        logbook_photo_path: "fake-logbook.jpg",
        nic_photo_path: "fake-nic.jpg",
      },
    });

    const res = await agent.get("/api/vehicles/transfer-requests/mine").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0]).toMatchObject({ status: "Pending", plate_no: "MINE-0001", make: "Toyota", model: "Vitz" });
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).get("/api/vehicles/transfer-requests/mine").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.get("/api/vehicles/transfer-requests/mine").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/vehicles/transfer-requests", () => {
  test("submits a transfer request against a vehicle owned by another customer", async () => {
    const { agent, customer } = await customerSession();
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "TRQ-0001" });

    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0001")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("fake-logbook-bytes"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("fake-nic-bytes"), "nic.jpg");

    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("Pending");

    const stored = await prisma.vehicleTransferRequest.findFirst({ where: { requester_id: customer.user_id } });
    expect(stored).not.toBeNull();
    expect(stored.logbook_photo_path).toBeTruthy();
    expect(stored.nic_photo_path).toBeTruthy();
  });

  test("saves the contact phone as a secondary phone when new", async () => {
    const { agent, customer } = await customerSession({ phone: "0700000000" });
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "TRQ-0002" });

    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0002")
      .field("contact_phone", "0719999999")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");

    expect(res.status).toBe(201);
    expect(res.body.profile_updated).toBe(true);
    const updatedCustomer = await prisma.customer.findUnique({ where: { user_id: customer.user_id } });
    expect(updatedCustomer.secondary_phone).toBe("0719999999");
  });

  test("400 when plate_no missing", async () => {
    const { agent } = await customerSession();
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(400);
  });

  test("400 when contact phone is invalid", async () => {
    const { agent } = await customerSession();
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "TRQ-0003" });
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0003")
      .field("contact_phone", "abc")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(400);
  });

  test("400 when photos are missing", async () => {
    const { agent } = await customerSession();
    const owner = await createUser("Customer");
    await createVehicle(owner.user_id, { plate_no: "TRQ-0004" });
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0004")
      .field("contact_phone", "0771234567");
    expect(res.status).toBe(400);
  });

  test("404 when no vehicle exists with that plate", async () => {
    const { agent } = await customerSession();
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "NOPE-0002")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(404);
  });

  test("400 when the vehicle is unclaimed", async () => {
    const { agent } = await customerSession();
    const previousOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "TRQ-0005", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0005")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(400);
  });

  test("400 when requesting a transfer of a vehicle the customer already owns", async () => {
    const { agent, customer } = await customerSession();
    await createVehicle(customer.user_id, { plate_no: "TRQ-0006" });
    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0006")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(400);
  });

  test("409 when a pending transfer request already exists for the vehicle", async () => {
    const { agent } = await customerSession();
    const owner = await createUser("Customer");
    const vehicle = await createVehicle(owner.user_id, { plate_no: "TRQ-0007" });
    await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicle.vehicle_id,
        requester_id: (await createUser("Customer")).user_id,
        current_owner_id: owner.user_id,
        contact_phone: "0771234567",
        logbook_photo_path: "x.jpg",
        nic_photo_path: "y.jpg",
      },
    });

    const res = await agent
      .post("/api/vehicles/transfer-requests")
      .set("X-Portal", "customer")
      .field("plate_no", "TRQ-0007")
      .field("contact_phone", "0771234567")
      .attach("logbook_photo", Buffer.from("a"), "logbook.jpg")
      .attach("nic_photo", Buffer.from("b"), "nic.jpg");
    expect(res.status).toBe(409);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).post("/api/vehicles/transfer-requests").set("X-Portal", "customer").field("plate_no", "X");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.post("/api/vehicles/transfer-requests").set("X-Portal", "staff").field("plate_no", "X");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/vehicles", () => {
  test("adds a vehicle via the catalog (existing make_id/model_id)", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID,
      model_id: VITZ_MODEL_ID,
      vehicle_type_id: CAR_TYPE_ID,
      year: 2019,
      plate_no: "ADD-0001",
    });
    expect(res.status).toBe(201);
    expect(res.body.vehicle).toMatchObject({ make: "Toyota", model: "Vitz", pending_catalog_review: false });
  });

  test("adds a vehicle via custom make/model, flagged as pending catalog review", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      custom_make: "Zoomer",
      custom_model: "X100",
      vehicle_type_id: CAR_TYPE_ID,
      plate_no: "ADD-0002",
    });
    expect(res.status).toBe(201);
    expect(res.body.vehicle).toMatchObject({
      make: "Zoomer",
      model: "X100",
      model_id: null,
      pending_catalog_review: true,
    });
  });

  test("400 when vehicle_type_id or plate_no missing", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({ make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID });
    expect(res.status).toBe(400);
  });

  test("400 when both make_id and custom_make are given", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID,
      custom_make: "Foo",
      model_id: VITZ_MODEL_ID,
      vehicle_type_id: CAR_TYPE_ID,
      plate_no: "ADD-0003",
    });
    expect(res.status).toBe(400);
  });

  test("400 when a custom make is paired with an existing model_id", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      custom_make: "Foo",
      model_id: VITZ_MODEL_ID,
      vehicle_type_id: CAR_TYPE_ID,
      plate_no: "ADD-0004",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/custom make cannot be paired/i);
  });

  test("409 with claimable: true when the plate is already registered but unclaimed", async () => {
    const { agent } = await customerSession();
    const previousOwner = await createUser("Customer");
    await createVehicle(null, { plate_no: "ADD-0005", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID,
      model_id: VITZ_MODEL_ID,
      vehicle_type_id: CAR_TYPE_ID,
      plate_no: "ADD-0005",
    });
    expect(res.status).toBe(409);
    expect(res.body.claimable).toBe(true);
  });

  test("400 when the plate is already actively registered to someone else", async () => {
    const { agent } = await customerSession();
    const otherOwner = await createUser("Customer");
    await createVehicle(otherOwner.user_id, { plate_no: "ADD-0006" });

    const res = await agent.post("/api/vehicles").set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID,
      model_id: VITZ_MODEL_ID,
      vehicle_type_id: CAR_TYPE_ID,
      plate_no: "ADD-0006",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).post("/api/vehicles").set("X-Portal", "customer").send({ plate_no: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.post("/api/vehicles").set("X-Portal", "staff").send({ plate_no: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("PUT /api/vehicles/:id", () => {
  test("updates a vehicle belonging to the authenticated customer", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(customer.user_id, { plate_no: "UPD-0001" });

    const res = await agent.put(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID,
      model_id: PRADO_MODEL_ID,
      vehicle_type_id: SUV_TYPE_ID,
      year: 2021,
      plate_no: "UPD-0002",
    });
    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({ model: "Land Cruiser Prado", vehicle_type: "SUV", plate_no: "UPD-0002" });
  });

  test("400 when required fields missing", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(customer.user_id, { plate_no: "UPD-0003" });
    const res = await agent.put(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer").send({ make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID });
    expect(res.status).toBe(400);
  });

  test("404 when the vehicle doesn't belong to the authenticated customer", async () => {
    const { agent } = await customerSession();
    const otherOwner = await createUser("Customer");
    const vehicle = await createVehicle(otherOwner.user_id, { plate_no: "UPD-0004" });
    const res = await agent.put(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer").send({
      make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID, vehicle_type_id: CAR_TYPE_ID, plate_no: "UPD-0005",
    });
    expect(res.status).toBe(404);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).put("/api/vehicles/1").set("X-Portal", "customer").send({});
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.put("/api/vehicles/1").set("X-Portal", "staff").send({});
    expect(wrongRole.status).toBe(403);
  });
});

describe("DELETE /api/vehicles/:id", () => {
  test("detaches a vehicle with no unresolved bookings", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(customer.user_id, { plate_no: "DEL-0001" });

    const res = await agent.delete(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer");
    expect(res.status).toBe(200);

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(updated.customer_id).toBeNull();
    expect(updated.previous_customer_id).toBe(customer.user_id);
    expect(updated.detached_at).not.toBeNull();
  });

  test("400 when the vehicle has an upcoming/in-progress booking", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(customer.user_id, { plate_no: "DEL-0002" });
    const pkg = await seedPackage();
    await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, estimatedDuration: pkg.estimated_duration });

    const res = await agent.delete(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer");
    expect(res.status).toBe(400);

    const unchanged = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(unchanged.customer_id).toBe(customer.user_id);
  });

  test("completed bookings don't block detach", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(customer.user_id, { plate_no: "DEL-0003" });
    const pkg = await seedPackage();
    await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, estimatedDuration: pkg.estimated_duration, status: "Completed" });

    const res = await agent.delete(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer");
    expect(res.status).toBe(200);
  });

  test("404 when the vehicle doesn't belong to the authenticated customer", async () => {
    const { agent } = await customerSession();
    const otherOwner = await createUser("Customer");
    const vehicle = await createVehicle(otherOwner.user_id, { plate_no: "DEL-0004" });
    const res = await agent.delete(`/api/vehicles/${vehicle.vehicle_id}`).set("X-Portal", "customer");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).delete("/api/vehicles/1").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.delete("/api/vehicles/1").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/vehicles/:id/restore", () => {
  test("restores a vehicle the customer previously detached", async () => {
    const { agent, customer } = await customerSession();
    const vehicle = await createVehicle(null, { plate_no: "RST-0001", customer_id: null, previous_customer_id: customer.user_id, detached_at: new Date() });

    const res = await agent.post(`/api/vehicles/${vehicle.vehicle_id}/restore`).set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.vehicle.plate_no).toBe("RST-0001");

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: vehicle.vehicle_id } });
    expect(updated.customer_id).toBe(customer.user_id);
    expect(updated.previous_customer_id).toBeNull();
    expect(updated.detached_at).toBeNull();
  });

  test("409 when the vehicle has already been claimed by another customer", async () => {
    const { agent, customer } = await customerSession();
    const newOwner = await createUser("Customer");
    const vehicle = await createVehicle(newOwner.user_id, { plate_no: "RST-0002", previous_customer_id: customer.user_id });

    const res = await agent.post(`/api/vehicles/${vehicle.vehicle_id}/restore`).set("X-Portal", "customer");
    expect(res.status).toBe(409);
  });

  test("403 when the vehicle was detached by a different customer", async () => {
    const { agent } = await customerSession();
    const previousOwner = await createUser("Customer");
    const vehicle = await createVehicle(null, { plate_no: "RST-0003", customer_id: null, previous_customer_id: previousOwner.user_id, detached_at: new Date() });

    const res = await agent.post(`/api/vehicles/${vehicle.vehicle_id}/restore`).set("X-Portal", "customer");
    expect(res.status).toBe(403);
  });

  test("404 when the vehicle doesn't exist", async () => {
    const { agent } = await customerSession();
    const res = await agent.post("/api/vehicles/999999/restore").set("X-Portal", "customer");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, wrong role -> 403", async () => {
    const noAuth = await request(app).post("/api/vehicles/1/restore").set("X-Portal", "customer");
    expect(noAuth.status).toBe(401);
    const { agent } = await managerSession();
    const wrongRole = await agent.post("/api/vehicles/1/restore").set("X-Portal", "staff");
    expect(wrongRole.status).toBe(403);
  });
});
