const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

// From backend/prisma/seed-data — real catalog rows loaded once by globalSetup.
const TOYOTA_MAKE_ID = 1;
const VITZ_MODEL_ID = 51; // Toyota Vitz
const PRADO_MODEL_ID = 54; // Toyota Land Cruiser Prado
const ALTO_MODEL_ID = 101; // Suzuki Alto — belongs to SUZUKI_MAKE_ID, not TOYOTA_MAKE_ID
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

beforeEach(async () => {
  await resetTransactionalTables();
});

// ---- Makes ------------------------------------------------------------

describe("GET /api/admin/vehicle-catalog/makes", () => {
  test("lists makes with model/vehicle counts", async () => {
    const { agent } = await managerSession();
    const res = await agent.get("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    const toyota = res.body.makes.find((m) => m.make_id === TOYOTA_MAKE_ID);
    expect(toyota).toBeDefined();
    expect(toyota.model_count).toBeGreaterThan(0);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicle-catalog/makes").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicle-catalog/makes", () => {
  test("creates a make", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "TestMake Alpha" });
    expect(res.status).toBe(201);
    expect(res.body.make.name).toBe("TestMake Alpha");
  });

  // VehicleMake has no unique constraint on name — the schema allows duplicates,
  // there's just no dedup safety net at this layer.
  test("allows a duplicate name (no uniqueness constraint in the schema)", async () => {
    const { agent } = await managerSession();
    const first = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "TestMake Dup" });
    const second = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "TestMake Dup" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.make.make_id).not.toBe(second.body.make.make_id);
  });

  test("400 when name is missing/empty", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "" });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "customer").send({ name: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("PUT /api/admin/vehicle-catalog/makes/:id", () => {
  test("renames a make", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "Rename Me" });
    const res = await agent.put(`/api/admin/vehicle-catalog/makes/${created.body.make.make_id}`).set("X-Portal", "staff").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.make.name).toBe("Renamed");
  });

  test("404 for a nonexistent make", async () => {
    const { agent } = await managerSession();
    const res = await agent.put("/api/admin/vehicle-catalog/makes/999999").set("X-Portal", "staff").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  test("400 when name is missing", async () => {
    const { agent } = await managerSession();
    const res = await agent.put(`/api/admin/vehicle-catalog/makes/${TOYOTA_MAKE_ID}`).set("X-Portal", "staff").send({});
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).put("/api/admin/vehicle-catalog/makes/1").set("X-Portal", "staff").send({ name: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.put("/api/admin/vehicle-catalog/makes/1").set("X-Portal", "customer").send({ name: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("DELETE /api/admin/vehicle-catalog/makes/:id", () => {
  test("deletes a make with no models/vehicles attached", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/makes").set("X-Portal", "staff").send({ name: "Deletable Make" });
    const res = await agent.delete(`/api/admin/vehicle-catalog/makes/${created.body.make.make_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("409 when the make still has models/vehicles attached", async () => {
    const { agent } = await managerSession();
    const res = await agent.delete(`/api/admin/vehicle-catalog/makes/${TOYOTA_MAKE_ID}`).set("X-Portal", "staff");
    expect(res.status).toBe(409);
  });

  test("404 for a nonexistent make", async () => {
    const { agent } = await managerSession();
    const res = await agent.delete("/api/admin/vehicle-catalog/makes/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).delete("/api/admin/vehicle-catalog/makes/1").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.delete("/api/admin/vehicle-catalog/makes/1").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

// ---- Models -----------------------------------------------------------

describe("GET /api/admin/vehicle-catalog/models", () => {
  test("lists all models, filters by make_id", async () => {
    const { agent } = await managerSession();
    const filtered = await agent.get(`/api/admin/vehicle-catalog/models?make_id=${TOYOTA_MAKE_ID}`).set("X-Portal", "staff");
    expect(filtered.status).toBe(200);
    expect(filtered.body.models.every((m) => m.make_id === TOYOTA_MAKE_ID)).toBe(true);
    expect(filtered.body.models.map((m) => m.model_id)).toContain(VITZ_MODEL_ID);
    expect(filtered.body.models.find((m) => m.model_id === VITZ_MODEL_ID).make_name).toBe("Toyota");
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicle-catalog/models").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicle-catalog/models").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicle-catalog/models", () => {
  test("creates a model under an existing make", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({
      name: "TestModel Alpha", make_id: TOYOTA_MAKE_ID, vehicle_type_id: CAR_TYPE_ID,
    });
    expect(res.status).toBe(201);
    expect(res.body.model.make_id).toBe(TOYOTA_MAKE_ID);
  });

  test("400 when make_id references a make that doesn't exist", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({
      name: "Orphan Model", make_id: 999999,
    });
    expect(res.status).toBe(400);
  });

  test("400 validation error when name missing", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({ make_id: TOYOTA_MAKE_ID });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({ name: "X", make_id: 1 });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "customer").send({ name: "X", make_id: 1 });
    expect(wrongRole.status).toBe(403);
  });
});

describe("PUT /api/admin/vehicle-catalog/models/:id", () => {
  test("updates a model", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({
      name: "Renameable Model", make_id: TOYOTA_MAKE_ID,
    });
    const res = await agent.put(`/api/admin/vehicle-catalog/models/${created.body.model.model_id}`).set("X-Portal", "staff").send({
      name: "Renamed Model", make_id: TOYOTA_MAKE_ID,
    });
    expect(res.status).toBe(200);
    expect(res.body.model.name).toBe("Renamed Model");
  });

  test("404 for a nonexistent model", async () => {
    const { agent } = await managerSession();
    const res = await agent.put("/api/admin/vehicle-catalog/models/999999").set("X-Portal", "staff").send({ name: "X", make_id: TOYOTA_MAKE_ID });
    expect(res.status).toBe(404);
  });

  test("400 when make_id is invalid", async () => {
    const { agent } = await managerSession();
    const res = await agent.put(`/api/admin/vehicle-catalog/models/${VITZ_MODEL_ID}`).set("X-Portal", "staff").send({ name: "X", make_id: 999999 });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).put("/api/admin/vehicle-catalog/models/1").set("X-Portal", "staff").send({ name: "X", make_id: 1 });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.put("/api/admin/vehicle-catalog/models/1").set("X-Portal", "customer").send({ name: "X", make_id: 1 });
    expect(wrongRole.status).toBe(403);
  });
});

describe("DELETE /api/admin/vehicle-catalog/models/:id", () => {
  test("deletes a model with no vehicles attached", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/models").set("X-Portal", "staff").send({
      name: "Deletable Model", make_id: TOYOTA_MAKE_ID,
    });
    const res = await agent.delete(`/api/admin/vehicle-catalog/models/${created.body.model.model_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("409 when the model still has vehicles attached", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    await prisma.vehicle.create({
      data: { customer_id: owner.user_id, make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID, vehicle_type_id: CAR_TYPE_ID, plate_no: "CAT-M001" },
    });
    const res = await agent.delete(`/api/admin/vehicle-catalog/models/${VITZ_MODEL_ID}`).set("X-Portal", "staff");
    expect(res.status).toBe(409);
  });

  test("404 for a nonexistent model", async () => {
    const { agent } = await managerSession();
    const res = await agent.delete("/api/admin/vehicle-catalog/models/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).delete("/api/admin/vehicle-catalog/models/1").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.delete("/api/admin/vehicle-catalog/models/1").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

// ---- Types --------------------------------------------------------------

describe("GET /api/admin/vehicle-catalog/types", () => {
  test("lists all vehicle types unfiltered, including Motorcycle/Three-Wheeler", async () => {
    const { agent } = await managerSession();
    const res = await agent.get("/api/admin/vehicle-catalog/types").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    const names = res.body.types.map((t) => t.name);
    expect(names).toContain("Motorcycle");
    expect(names).toContain("Three-Wheeler");
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicle-catalog/types").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicle-catalog/types").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicle-catalog/types", () => {
  test("creates a type", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/types").set("X-Portal", "staff").send({ name: "TestType Alpha" });
    expect(res.status).toBe(201);
  });

  test("400 when name is missing/empty", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/types").set("X-Portal", "staff").send({ name: "" });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicle-catalog/types").set("X-Portal", "staff").send({ name: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicle-catalog/types").set("X-Portal", "customer").send({ name: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("PUT /api/admin/vehicle-catalog/types/:id", () => {
  test("renames a type", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/types").set("X-Portal", "staff").send({ name: "Rename Type Me" });
    const res = await agent.put(`/api/admin/vehicle-catalog/types/${created.body.type.type_id}`).set("X-Portal", "staff").send({ name: "Renamed Type" });
    expect(res.status).toBe(200);
    expect(res.body.type.name).toBe("Renamed Type");
  });

  test("404 for a nonexistent type", async () => {
    const { agent } = await managerSession();
    const res = await agent.put("/api/admin/vehicle-catalog/types/999999").set("X-Portal", "staff").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).put("/api/admin/vehicle-catalog/types/1").set("X-Portal", "staff").send({ name: "X" });
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.put("/api/admin/vehicle-catalog/types/1").set("X-Portal", "customer").send({ name: "X" });
    expect(wrongRole.status).toBe(403);
  });
});

describe("DELETE /api/admin/vehicle-catalog/types/:id", () => {
  test("deletes a type with no models/vehicles attached", async () => {
    const { agent } = await managerSession();
    const created = await agent.post("/api/admin/vehicle-catalog/types").set("X-Portal", "staff").send({ name: "Deletable Type" });
    const res = await agent.delete(`/api/admin/vehicle-catalog/types/${created.body.type.type_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("409 when the type still has models/vehicles attached", async () => {
    const { agent } = await managerSession();
    const res = await agent.delete(`/api/admin/vehicle-catalog/types/${CAR_TYPE_ID}`).set("X-Portal", "staff");
    expect(res.status).toBe(409);
  });

  test("404 for a nonexistent type", async () => {
    const { agent } = await managerSession();
    const res = await agent.delete("/api/admin/vehicle-catalog/types/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).delete("/api/admin/vehicle-catalog/types/1").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.delete("/api/admin/vehicle-catalog/types/1").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

// ---- Pending customer submissions ---------------------------------------

describe("GET /api/admin/vehicle-catalog/pending-submissions", () => {
  test("lists vehicles registered with a custom make/model awaiting review", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    await prisma.vehicle.create({
      data: {
        customer_id: owner.user_id, vehicle_type_id: CAR_TYPE_ID,
        custom_make: "Zoomer", custom_model: "X100", plate_no: "PND-0001",
      },
    });

    const res = await agent.get("/api/admin/vehicle-catalog/pending-submissions").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0]).toMatchObject({ plate_no: "PND-0001", custom_make: "Zoomer", custom_model: "X100", customer_email: owner.email });
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).get("/api/admin/vehicle-catalog/pending-submissions").set("X-Portal", "staff");
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.get("/api/admin/vehicle-catalog/pending-submissions").set("X-Portal", "customer");
    expect(wrongRole.status).toBe(403);
  });
});

describe("POST /api/admin/vehicle-catalog/pending-submissions/resolve", () => {
  test("links pending vehicles to a real make/model, clearing pending status", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const pending = await prisma.vehicle.create({
      data: { customer_id: owner.user_id, vehicle_type_id: CAR_TYPE_ID, custom_make: "Zoomer", custom_model: "X100", plate_no: "RSV-0001" },
    });

    const res = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({
      vehicle_ids: [pending.vehicle_id], make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID,
    });
    expect(res.status).toBe(200);
    expect(res.body.resolved_count).toBe(1);

    const updated = await prisma.vehicle.findUnique({ where: { vehicle_id: pending.vehicle_id } });
    expect(updated.make_id).toBe(TOYOTA_MAKE_ID);
    expect(updated.model_id).toBe(VITZ_MODEL_ID);
  });

  test("only touches vehicles still pending — doesn't re-resolve an already-resolved submission", async () => {
    const { agent } = await managerSession();
    const owner = await createUser("Customer");
    const stillPending = await prisma.vehicle.create({
      data: { customer_id: owner.user_id, vehicle_type_id: CAR_TYPE_ID, custom_make: "Foo", custom_model: "Bar", plate_no: "RSV-0002" },
    });
    const alreadyResolved = await prisma.vehicle.create({
      data: { customer_id: owner.user_id, vehicle_type_id: CAR_TYPE_ID, make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID, plate_no: "RSV-0003" },
    });

    const res = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({
      vehicle_ids: [stillPending.vehicle_id, alreadyResolved.vehicle_id], make_id: TOYOTA_MAKE_ID, model_id: PRADO_MODEL_ID,
    });
    expect(res.status).toBe(200);
    expect(res.body.resolved_count).toBe(1);

    const untouched = await prisma.vehicle.findUnique({ where: { vehicle_id: alreadyResolved.vehicle_id } });
    expect(untouched.model_id).toBe(VITZ_MODEL_ID);
  });

  test("404 when model_id doesn't exist", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({
      vehicle_ids: [1], make_id: TOYOTA_MAKE_ID, model_id: 999999,
    });
    expect(res.status).toBe(404);
  });

  test("400 when the model doesn't belong to the given make", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({
      vehicle_ids: [1], make_id: TOYOTA_MAKE_ID, model_id: ALTO_MODEL_ID,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not belong/i);
  });

  test("400 validation error when vehicle_ids is empty", async () => {
    const { agent } = await managerSession();
    const res = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({
      vehicle_ids: [], make_id: TOYOTA_MAKE_ID, model_id: VITZ_MODEL_ID,
    });
    expect(res.status).toBe(400);
  });

  test("no token -> 401, non-manager -> 403", async () => {
    const noAuth = await request(app).post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "staff").send({});
    expect(noAuth.status).toBe(401);
    const { agent } = await customerSession();
    const wrongRole = await agent.post("/api/admin/vehicle-catalog/pending-submissions/resolve").set("X-Portal", "customer").send({});
    expect(wrongRole.status).toBe(403);
  });
});
