const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

// NOTE: unlike packages/charge-catalog, working_config and blocked_times are
// NOT cleared by resetTransactionalTables() (they're treated as global
// reference data — see tests/helpers/db.js). Every test below therefore sets
// up the exact state it needs via the API itself instead of relying on the
// seeded defaults still being in place, so it stays correct no matter what
// order tests run in.

beforeEach(async () => {
  await resetTransactionalTables();
});

async function managerAgent() {
  const manager = await createUser("Service Center Manager");
  const agent = request.agent(app);
  await loginAs(agent, manager, "staff");
  return agent;
}

describe("GET /api/config", () => {
  test("authenticated manager gets working config reflecting the latest update", async () => {
    const agent = await managerAgent();
    await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5,6",
      day_start_time: "09:00",
      day_end_time: "17:00",
      same_day_cutoff_minutes: 120,
    });

    const res = await agent.get("/api/config").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.config.working_days).toBe("1,2,3,4,5,6");
    expect(res.body.config.day_start_time).toBe("09:00:00");
    expect(res.body.config.day_end_time).toBe("17:00:00");
    expect(res.body.config.same_day_cutoff_minutes).toBe(120);
    expect(Array.isArray(res.body.blocked_times)).toBe(true);
  });

  // GET /api/config only requires verifyToken — no authorizeRoles — so it's
  // readable by any authenticated role, not just the manager (customers need
  // business hours too, to render the booking calendar).
  test("is readable by non-manager staff roles", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.get("/api/config").set("X-Portal", "staff");
    expect(res.status).toBe(200);
  });

  test("is readable by a logged-in customer", async () => {
    const customer = await createUser("Customer");
    const agent = request.agent(app);
    await loginAs(agent, customer, "customer");

    const res = await agent.get("/api/config").set("X-Portal", "customer");
    expect(res.status).toBe(200);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/config", () => {
  test("manager updates working days and hours", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:30",
      day_end_time: "17:30",
      same_day_cutoff_minutes: 180,
    });
    expect(res.status).toBe(200);
    expect(res.body.config.day_start_time).toBe("08:30:00");
    expect(res.body.config.day_end_time).toBe("17:30:00");
    expect(res.body.config.same_day_cutoff_minutes).toBe(180);
  });

  test("update is optional on same_day_cutoff_minutes — leaves it unchanged when omitted", async () => {
    const agent = await managerAgent();
    await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
      same_day_cutoff_minutes: 90,
    });

    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
    });
    expect(res.status).toBe(200);
    expect(res.body.config.same_day_cutoff_minutes).toBe(90);
  });

  test("rejects missing required fields", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config").set("X-Portal", "staff").send({ working_days: "1,2,3,4,5" });
    expect(res.status).toBe(400);
  });

  test("rejects day_end_time not after day_start_time", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "18:00",
      day_end_time: "08:00",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/day_end_time must be after day_start_time/i);
  });

  test("rejects a negative same_day_cutoff_minutes", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
      same_day_cutoff_minutes: -10,
    });
    expect(res.status).toBe(400);
  });

  test("rejects a non-integer same_day_cutoff_minutes", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
      same_day_cutoff_minutes: 12.5,
    });
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.put("/api/config").set("X-Portal", "staff").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
    });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).put("/api/config").send({
      working_days: "1,2,3,4,5",
      day_start_time: "08:00",
      day_end_time: "18:00",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/config/contact", () => {
  test("readable without authentication", async () => {
    const agent = await managerAgent();
    await agent.put("/api/config/contact").set("X-Portal", "staff").send({ contact_phone: "+94 77 830 8747" });

    const res = await request(app).get("/api/config/contact");
    expect(res.status).toBe(200);
    expect(res.body.contact_phone).toBe("+94 77 830 8747");
  });
});

describe("PUT /api/config/contact", () => {
  test("manager updates the contact phone", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config/contact").set("X-Portal", "staff").send({ contact_phone: "+94 11 234 5678" });
    expect(res.status).toBe(200);
    expect(res.body.contact_phone).toBe("+94 11 234 5678");
  });

  test("rejects a malformed phone number", async () => {
    const agent = await managerAgent();
    const res = await agent.put("/api/config/contact").set("X-Portal", "staff").send({ contact_phone: "not a phone" });
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");

    const res = await agent.put("/api/config/contact").set("X-Portal", "staff").send({ contact_phone: "+94 77 830 8747" });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).put("/api/config/contact").send({ contact_phone: "+94 77 830 8747" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/config/blocked-times", () => {
  test("manager adds a recurring blocked time (no date = applies every working day)", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      start_time: "15:00",
      end_time: "15:15",
      reason: "Staff briefing",
    });
    expect(res.status).toBe(201);
    expect(res.body.block.date).toBeNull();
    expect(res.body.block.start_time).toBe("15:00:00");
    expect(res.body.block.end_time).toBe("15:15:00");
    expect(res.body.block.reason).toBe("Staff briefing");
  });

  test("manager adds a one-off dated blocked time", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      date: "2026-08-15",
      start_time: "10:00",
      end_time: "11:00",
      reason: "Public holiday",
    });
    expect(res.status).toBe(201);
    expect(res.body.block.date).toBe("2026-08-15");
  });

  test("newly added blocked time shows up in GET /api/config", async () => {
    const agent = await managerAgent();
    const addRes = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      date: "2026-09-01",
      start_time: "09:00",
      end_time: "09:30",
      reason: "Equipment maintenance",
    });

    const getRes = await agent.get("/api/config").set("X-Portal", "staff");
    const found = getRes.body.blocked_times.find((b) => b.block_id === addRes.body.block.block_id);
    expect(found).toBeDefined();
    expect(found.reason).toBe("Equipment maintenance");
  });

  test("rejects missing start_time/end_time", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({ start_time: "10:00" });
    expect(res.status).toBe(400);
  });

  test("rejects end_time not after start_time", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      start_time: "11:00",
      end_time: "10:00",
    });
    expect(res.status).toBe(400);
  });

  test("rejects non-manager", async () => {
    const cashier = await createUser("Cashier");
    const agent = request.agent(app);
    await loginAs(agent, cashier, "staff");

    const res = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      start_time: "10:00",
      end_time: "11:00",
    });
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/config/blocked-times").send({ start_time: "10:00", end_time: "11:00" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/config/blocked-times/:id", () => {
  test("manager removes a blocked time", async () => {
    const agent = await managerAgent();
    const addRes = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      start_time: "16:00",
      end_time: "16:30",
      reason: "Temp block",
    });

    const res = await agent.delete(`/api/config/blocked-times/${addRes.body.block.block_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(200);

    const getRes = await agent.get("/api/config").set("X-Portal", "staff");
    const stillThere = getRes.body.blocked_times.some((b) => b.block_id === addRes.body.block.block_id);
    expect(stillThere).toBe(false);
  });

  test("404s for a non-existent blocked time", async () => {
    const agent = await managerAgent();
    const res = await agent.delete("/api/config/blocked-times/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("rejects non-manager", async () => {
    const agent = await managerAgent();
    const addRes = await agent.post("/api/config/blocked-times").set("X-Portal", "staff").send({
      start_time: "16:00",
      end_time: "16:30",
    });

    const staff = await createUser("Service Staff");
    const staffAgent = request.agent(app);
    await loginAs(staffAgent, staff, "staff");

    const res = await staffAgent.delete(`/api/config/blocked-times/${addRes.body.block.block_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated request", async () => {
    const res = await request(app).delete("/api/config/blocked-times/1");
    expect(res.status).toBe(401);
  });
});
