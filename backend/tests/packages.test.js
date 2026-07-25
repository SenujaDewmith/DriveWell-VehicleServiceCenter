const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

beforeEach(async () => {
  await resetTransactionalTables();
});

const validPayload = (overrides = {}) => ({
  name: "Full Service",
  package_code: "DWP-FULL01",
  description: "Complete inspection and service",
  estimated_duration: 90,
  price: 8000,
  max_capacity: 2,
  ...overrides,
});

describe("GET /api/packages", () => {
  test("guest sees only active packages", async () => {
    const active = await seedPackage({ name: "Active Pkg", package_code: "DWP-ACT1", is_active: true });
    await seedPackage({ name: "Inactive Pkg", package_code: "DWP-INA1", is_active: false });

    const res = await request(app).get("/api/packages");
    expect(res.status).toBe(200);
    expect(res.body.packages).toHaveLength(1);
    expect(res.body.packages[0].package_id).toBe(active.package_id);
  });

  test("non-manager staff also see only active packages", async () => {
    await seedPackage({ name: "Active Pkg", package_code: "DWP-ACT2", is_active: true });
    await seedPackage({ name: "Inactive Pkg", package_code: "DWP-INA2", is_active: false });

    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.get("/api/packages").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.packages).toHaveLength(1);
    expect(res.body.packages.every((p) => p.is_active)).toBe(true);
  });

  test("manager sees active and inactive packages", async () => {
    await seedPackage({ name: "Active Pkg", package_code: "DWP-ACT3", is_active: true });
    await seedPackage({ name: "Inactive Pkg", package_code: "DWP-INA3", is_active: false });

    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.get("/api/packages").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.packages).toHaveLength(2);
  });
});

describe("GET /api/packages/:id", () => {
  // Route has no auth middleware at all — anyone with an id, including one
  // for an inactive package, can fetch it directly.
  test("is public and returns an inactive package's details too", async () => {
    const pkg = await seedPackage({ is_active: false });
    const res = await request(app).get(`/api/packages/${pkg.package_id}`);
    expect(res.status).toBe(200);
    expect(res.body.package.package_id).toBe(pkg.package_id);
    expect(res.body.package.is_active).toBe(false);
  });

  test("404s for a non-existent package", async () => {
    const res = await request(app).get("/api/packages/999999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/packages", () => {
  test("manager creates a package", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.post("/api/packages").set("X-Portal", "staff").send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.package.name).toBe("Full Service");
    expect(res.body.package.package_code).toBe("DWP-FULL01");
    expect(res.body.package.is_active).toBe(true);
    expect(res.body.package.is_featured).toBe(false);
  });

  test("rejects invalid payload", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.post("/api/packages").set("X-Portal", "staff").send(validPayload({ package_code: "not-a-valid-code" }));
    expect(res.status).toBe(400);
  });

  test("rejects a duplicate package_code", async () => {
    await seedPackage({ package_code: "DWP-DUP01" });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.post("/api/packages").set("X-Portal", "staff").send(validPayload({ package_code: "DWP-DUP01" }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already in use/i);
  });

  test("rejects non-manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.post("/api/packages").set("X-Portal", "staff").send(validPayload());
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/packages").send(validPayload());
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/packages/:id", () => {
  test("manager updates a package", async () => {
    const pkg = await seedPackage({ package_code: "DWP-UPD01" });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent
      .put(`/api/packages/${pkg.package_id}`)
      .set("X-Portal", "staff")
      .send(validPayload({ package_code: "DWP-UPD01", name: "Updated Name", price: 9000 }));
    expect(res.status).toBe(200);
    expect(res.body.package.name).toBe("Updated Name");
    expect(Number(res.body.package.price)).toBe(9000);
  });

  test("404s for a non-existent package", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.put("/api/packages/999999").set("X-Portal", "staff").send(validPayload());
    expect(res.status).toBe(404);
  });

  test("rejects a package_code already used by another package", async () => {
    await seedPackage({ package_code: "DWP-TAKEN" });
    const pkg = await seedPackage({ package_code: "DWP-FREE1" });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent
      .put(`/api/packages/${pkg.package_id}`)
      .set("X-Portal", "staff")
      .send(validPayload({ package_code: "DWP-TAKEN" }));
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const pkg = await seedPackage();
    const staff = await createUser("Service Staff");
    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");

    const res = await agent.put(`/api/packages/${pkg.package_id}`).set("X-Portal", "staff").send(validPayload());
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/packages/:id/deactivate and /activate", () => {
  test("manager deactivates a package (soft delete, row still exists)", async () => {
    const pkg = await seedPackage({ is_active: true });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/deactivate`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.package.package_id).toBe(pkg.package_id);

    // Confirm it's a soft delete — the row is still fetchable, just inactive.
    const getRes = await request(app).get(`/api/packages/${pkg.package_id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.package.is_active).toBe(false);
  });

  test("manager reactivates a package", async () => {
    const pkg = await seedPackage({ is_active: false });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/activate`).set("X-Portal", "staff");
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/packages/${pkg.package_id}`);
    expect(getRes.body.package.is_active).toBe(true);
  });

  test("404s deactivating a non-existent package", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch("/api/packages/999999/deactivate").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("rejects non-manager", async () => {
    const pkg = await seedPackage();
    const cashier = await createUser("Cashier");
    const agent = request.agent(app);
    await loginAs(agent, cashier, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/deactivate`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const pkg = await seedPackage();
    const res = await request(app).patch(`/api/packages/${pkg.package_id}/deactivate`);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/packages/:id/feature and /unfeature", () => {
  test("manager features a package for the landing page", async () => {
    const pkg = await seedPackage({ is_featured: false });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/packages/${pkg.package_id}`);
    expect(getRes.body.package.is_featured).toBe(true);
  });

  test("manager unfeatures a package", async () => {
    const pkg = await seedPackage({ is_featured: true });
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/unfeature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/packages/${pkg.package_id}`);
    expect(getRes.body.package.is_featured).toBe(false);
  });

  // is_featured is a manager-curated "pick", not derived from booking counts —
  // capped at MAX_FEATURED_PACKAGES (5) landing-page slots.
  test("refuses to feature a 6th package once 5 are already featured", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    for (let i = 0; i < 5; i++) {
      await seedPackage({ package_code: `DWP-FEAT${i}`, is_featured: true });
    }
    const sixth = await seedPackage({ package_code: "DWP-FEAT5", is_featured: false });

    const res = await agent.patch(`/api/packages/${sixth.package_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already have 5/i);
  });

  test("re-featuring an already-featured package does not hit the cap", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    for (let i = 0; i < 5; i++) {
      await seedPackage({ package_code: `DWP-FEATB${i}`, is_featured: true });
    }
    const [alreadyFeatured] = await request(app).get("/api/packages").then((r) => r.body.packages);

    const res = await agent.patch(`/api/packages/${alreadyFeatured.package_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("rejects non-manager", async () => {
    const pkg = await seedPackage();
    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.patch(`/api/packages/${pkg.package_id}/feature`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});

describe("POST /api/packages/:id/image", () => {
  const pngBuffer = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  test("manager uploads a package image", async () => {
    const pkg = await seedPackage();
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent
      .post(`/api/packages/${pkg.package_id}/image`)
      .set("X-Portal", "staff")
      .attach("image", pngBuffer(), "test.png");
    expect(res.status).toBe(200);
    expect(res.body.package.image_url).toMatch(/^\/uploads\/packages\//);
  });

  test("rejects a non-image file", async () => {
    const pkg = await seedPackage();
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent
      .post(`/api/packages/${pkg.package_id}/image`)
      .set("X-Portal", "staff")
      .attach("image", Buffer.from("not an image"), "test.txt");
    expect(res.status).toBe(400);
  });

  test("rejects when no file is attached", async () => {
    const pkg = await seedPackage();
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.post(`/api/packages/${pkg.package_id}/image`).set("X-Portal", "staff");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no image file/i);
  });

  test("404s for a non-existent package", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent
      .post("/api/packages/999999/image")
      .set("X-Portal", "staff")
      .attach("image", pngBuffer(), "test.png");
    expect(res.status).toBe(404);
  });

  test("rejects non-manager", async () => {
    const pkg = await seedPackage();
    const staff = await createUser("Service Staff");
    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");

    const res = await agent
      .post(`/api/packages/${pkg.package_id}/image`)
      .set("X-Portal", "staff")
      .attach("image", pngBuffer(), "test.png");
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/packages/:id/image", () => {
  const pngBuffer = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  test("manager removes a package image", async () => {
    const pkg = await seedPackage();
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    await agent.post(`/api/packages/${pkg.package_id}/image`).set("X-Portal", "staff").attach("image", pngBuffer(), "test.png");

    const res = await agent.delete(`/api/packages/${pkg.package_id}/image`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.package.image_url).toBeNull();
  });

  test("404s for a non-existent package", async () => {
    const manager = await createUser("Service Center Manager");
    const agent = request.agent(app);
    await loginAs(agent, manager, "staff");

    const res = await agent.delete("/api/packages/999999/image").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("rejects non-manager", async () => {
    const pkg = await seedPackage();
    const cashier = await createUser("Cashier");
    const agent = request.agent(app);
    await loginAs(agent, cashier, "staff");

    const res = await agent.delete(`/api/packages/${pkg.package_id}/image`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});
