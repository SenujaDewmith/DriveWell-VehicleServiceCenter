const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables, seedChargeCatalogItem } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

beforeEach(async () => {
  await resetTransactionalTables();
});

async function agentAs(roleName, portal = "staff") {
  const user = await createUser(roleName);
  const agent = request.agent(app);
  await loginAs(agent, user, portal);
  return agent;
}

describe("GET /api/charge-catalog", () => {
  test("manager sees active and inactive items", async () => {
    await seedChargeCatalogItem({ name: "Active Item", is_active: true });
    await seedChargeCatalogItem({ name: "Inactive Item", is_active: false });
    const agent = await agentAs("Service Center Manager");

    const res = await agent.get("/api/charge-catalog").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  // Read access is gated only by verifyToken (no authorizeRoles), so any
  // authenticated staff role — not just the manager — can browse the catalog
  // to price invoices/service-record items. Non-managers only see active items.
  test("cashier sees only active items (read access for pricing invoices)", async () => {
    await seedChargeCatalogItem({ name: "Active Item", is_active: true });
    await seedChargeCatalogItem({ name: "Inactive Item", is_active: false });
    const agent = await agentAs("Cashier");

    const res = await agent.get("/api/charge-catalog").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].is_active).toBe(true);
  });

  test("supervisor sees only active items", async () => {
    await seedChargeCatalogItem({ name: "Active Item", is_active: true });
    await seedChargeCatalogItem({ name: "Inactive Item", is_active: false });
    const agent = await agentAs("Supervisor");

    const res = await agent.get("/api/charge-catalog").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/charge-catalog");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/charge-catalog", () => {
  test("manager creates a charge catalog item", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.post("/api/charge-catalog").set("X-Portal", "staff").send({
      name: "Timing Belt Replacement",
      description: "Includes tensioner",
      default_price: 15000,
      category: "Parts",
    });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe("Timing Belt Replacement");
    expect(Number(res.body.item.default_price)).toBe(15000);
    expect(res.body.item.is_active).toBe(true);
  });

  test("rejects missing name", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.post("/api/charge-catalog").set("X-Portal", "staff").send({ default_price: 100 });
    expect(res.status).toBe(400);
  });

  test("rejects a negative default_price", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.post("/api/charge-catalog").set("X-Portal", "staff").send({
      name: "Bad Price Item",
      default_price: -5,
    });
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const agent = await agentAs("Supervisor");
    const res = await agent.post("/api/charge-catalog").set("X-Portal", "staff").send({
      name: "Should Fail",
      default_price: 100,
    });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/charge-catalog").send({ name: "Should Fail", default_price: 100 });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/charge-catalog/quick-add", () => {
  test("supervisor quick-adds a new item priced at 0, tagged Supervisor Added", async () => {
    const agent = await agentAs("Supervisor");
    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({ name: "Wiper Blade Replacement" });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(Number(res.body.item.default_price)).toBe(0);
    expect(res.body.item.category).toBe("Supervisor Added");
  });

  test("reuses an existing active item on a case-insensitive name match instead of duplicating", async () => {
    const existing = await seedChargeCatalogItem({ name: "Brake Pad Replacement", is_active: true });
    const agent = await agentAs("Supervisor");

    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({ name: "brake pad replacement" });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.item.catalog_item_id).toBe(existing.catalog_item_id);

    const listRes = await agent.get("/api/charge-catalog").set("X-Portal", "staff");
    expect(listRes.body.items).toHaveLength(1);
  });

  test("does not match an inactive item — creates a new one instead", async () => {
    await seedChargeCatalogItem({ name: "Brake Pad Replacement", is_active: false });
    const agent = await agentAs("Supervisor");

    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({ name: "Brake Pad Replacement" });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
  });

  test("manager can also quick-add", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({ name: "Manager Quick Add" });
    expect(res.status).toBe(201);
  });

  test("rejects missing name", async () => {
    const agent = await agentAs("Supervisor");
    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({});
    expect(res.status).toBe(400);
  });

  test("rejects cashier (not supervisor or manager)", async () => {
    const agent = await agentAs("Cashier");
    const res = await agent.post("/api/charge-catalog/quick-add").set("X-Portal", "staff").send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/charge-catalog/quick-add").send({ name: "Should Fail" });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/charge-catalog/:id", () => {
  test("manager updates a charge catalog item", async () => {
    const item = await seedChargeCatalogItem({ name: "Old Name", default_price: 1000 });
    const agent = await agentAs("Service Center Manager");

    const res = await agent.put(`/api/charge-catalog/${item.catalog_item_id}`).set("X-Portal", "staff").send({
      name: "New Name",
      default_price: 2500,
      category: "Labour",
    });
    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe("New Name");
    expect(Number(res.body.item.default_price)).toBe(2500);
  });

  test("404s for a non-existent item", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.put("/api/charge-catalog/999999").set("X-Portal", "staff").send({
      name: "Nope",
      default_price: 100,
    });
    expect(res.status).toBe(404);
  });

  test("rejects invalid payload", async () => {
    const item = await seedChargeCatalogItem();
    const agent = await agentAs("Service Center Manager");
    const res = await agent.put(`/api/charge-catalog/${item.catalog_item_id}`).set("X-Portal", "staff").send({
      name: "",
      default_price: 100,
    });
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const item = await seedChargeCatalogItem();
    const agent = await agentAs("Supervisor");
    const res = await agent.put(`/api/charge-catalog/${item.catalog_item_id}`).set("X-Portal", "staff").send({
      name: "Hacked",
      default_price: 1,
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/charge-catalog/:id/deactivate and /activate", () => {
  test("manager deactivates an item (soft delete — still readable by manager afterwards)", async () => {
    const item = await seedChargeCatalogItem({ is_active: true });
    const agent = await agentAs("Service Center Manager");

    const res = await agent.patch(`/api/charge-catalog/${item.catalog_item_id}/deactivate`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.item.is_active).toBe(false);

    const listRes = await agent.get("/api/charge-catalog").set("X-Portal", "staff");
    expect(listRes.body.items.some((i) => i.catalog_item_id === item.catalog_item_id)).toBe(true);
  });

  test("manager reactivates an item", async () => {
    const item = await seedChargeCatalogItem({ is_active: false });
    const agent = await agentAs("Service Center Manager");

    const res = await agent.patch(`/api/charge-catalog/${item.catalog_item_id}/activate`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.item.is_active).toBe(true);
  });

  test("404s deactivating a non-existent item", async () => {
    const agent = await agentAs("Service Center Manager");
    const res = await agent.patch("/api/charge-catalog/999999/deactivate").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("rejects non-manager", async () => {
    const item = await seedChargeCatalogItem();
    const agent = await agentAs("Cashier");
    const res = await agent.patch(`/api/charge-catalog/${item.catalog_item_id}/deactivate`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const item = await seedChargeCatalogItem();
    const res = await request(app).patch(`/api/charge-catalog/${item.catalog_item_id}/deactivate`);
    expect(res.status).toBe(401);
  });
});
