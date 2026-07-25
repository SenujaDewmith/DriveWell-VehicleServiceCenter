const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables } = require("./helpers/db");
const { createUser } = require("./helpers/auth");

// Not exported by helpers/auth.js — pulled straight from tests/setup/seedReferenceData.js,
// which is the fixed manager account resetTransactionalTables() recreates every test.
const { MANAGER_EMAIL: SEEDED_MANAGER_EMAIL } = require("./setup/seedReferenceData");

beforeEach(async () => {
  await resetTransactionalTables();
});

// Nearly every test here needs an authenticated agent, and resetTransactionalTables()
// runs in beforeEach, so going through the real POST /api/auth/staff/login for each
// one would blow past loginLimiter's cap (20 requests / 15 min, shared by /login and
// /staff/login) well before this file finishes — the real login flow is already
// covered end-to-end in auth.test.js. Instead we mint the same JWT the controller
// would issue and attach it directly as a cookie, exercising verifyToken/authorizeRoles
// without touching the rate limiter.
const mintToken = (user) =>
  jwt.sign({ user_id: user.user_id, email: user.email, role_id: user.role_id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

function authedAgent(user, portal) {
  const cookieName = portal === "customer" ? "customer_token" : "staff_token";
  const headers = { "X-Portal": portal, Cookie: `${cookieName}=${mintToken(user)}` };
  return {
    get: (url) => request(app).get(url).set(headers),
    post: (url) => request(app).post(url).set(headers),
    put: (url) => request(app).put(url).set(headers),
    patch: (url) => request(app).patch(url).set(headers),
  };
}

async function managerAgent() {
  const manager = await prisma.user.findUnique({ where: { email: SEEDED_MANAGER_EMAIL } });
  return authedAgent(manager, "staff");
}

async function staffAgent(roleName, overrides = {}) {
  const staff = await createUser(roleName, overrides);
  const portal = roleName === "Customer" ? "customer" : "staff";
  const agent = authedAgent(staff, portal);
  return { staff, agent, portal };
}

describe("GET /api/users/staff", () => {
  test("manager can list all staff accounts with flattened profile fields", async () => {
    await createUser("Supervisor", { email: "list.supervisor@test.local", full_name: "List Supervisor" });
    await createUser("Cashier", { email: "list.cashier@test.local", full_name: "List Cashier" });
    const agent = await managerAgent();

    const res = await agent.get("/api/users/staff").set("X-Portal", "staff");

    expect(res.status).toBe(200);
    // manager (seeded) + the two just created
    expect(res.body.staff.length).toBeGreaterThanOrEqual(3);
    const cashier = res.body.staff.find((s) => s.email === "list.cashier@test.local");
    expect(cashier.full_name).toBe("List Cashier");
    expect(cashier.role_name).toBe("Cashier");
  });

  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/users/staff").set("X-Portal", "staff");
    expect(res.status).toBe(401);
  });

  test.each(["Supervisor", "Cashier", "Service Staff", "Customer"])("rejects a %s account with 403", async (roleName) => {
    const { agent, portal } = await staffAgent(roleName, { email: `rbac.${roleName.toLowerCase().replace(/ /g, "")}@test.local` });
    const res = await agent.get("/api/users/staff").set("X-Portal", portal);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access denied. Insufficient permissions.");
  });
});

describe("GET /api/users/customers", () => {
  test("manager can list all customer accounts", async () => {
    await createUser("Customer", { email: "list.customer@test.local", full_name: "List Customer", phone: "0711112222" });
    const agent = await managerAgent();

    const res = await agent.get("/api/users/customers").set("X-Portal", "staff");

    expect(res.status).toBe(200);
    const customer = res.body.customers.find((c) => c.email === "list.customer@test.local");
    expect(customer.full_name).toBe("List Customer");
    expect(customer.phone).toBe("0711112222");
  });

  test("rejects a non-manager staff account with 403", async () => {
    const { agent } = await staffAgent("Supervisor", { email: "customers.supervisor@test.local" });
    const res = await agent.get("/api/users/customers").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/users/staff/:id", () => {
  test("returns a single staff member's details", async () => {
    const target = await createUser("Cashier", { email: "single.cashier@test.local", full_name: "Single Cashier" });
    const agent = await managerAgent();

    const res = await agent.get(`/api/users/staff/${target.user_id}`).set("X-Portal", "staff");

    expect(res.status).toBe(200);
    expect(res.body.staff.full_name).toBe("Single Cashier");
    expect(res.body.staff.role_name).toBe("Cashier");
  });

  test("returns 404 for a non-existent id", async () => {
    const agent = await managerAgent();
    const res = await agent.get("/api/users/staff/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });

  test("returns 404 when the id belongs to a customer, not staff", async () => {
    const customer = await createUser("Customer", { email: "notstaff@test.local" });
    const agent = await managerAgent();
    const res = await agent.get(`/api/users/staff/${customer.user_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/users/staff", () => {
  test("manager can create a new staff account", async () => {
    const agent = await managerAgent();

    const res = await agent.post("/api/users/staff").set("X-Portal", "staff").send({
      email: "new.staff@test.local",
      password: "Passw0rd!",
      full_name: "New Staff Member",
      role_id: 4,
      phone_no: "0771112233",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Staff account created");
    expect(res.body.user.role_id).toBe(4);

    const staffRow = await prisma.staff.findUnique({ where: { user_id: res.body.user.user_id } });
    expect(staffRow.full_name).toBe("New Staff Member");
  });

  test("rejects missing required fields with 400", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/users/staff").set("X-Portal", "staff").send({ email: "incomplete@test.local" });
    expect(res.status).toBe(400);
  });

  test("rejects a role_id outside the staff range", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/users/staff").set("X-Portal", "staff").send({
      email: "badrole@test.local",
      password: "Passw0rd!",
      full_name: "Bad Role",
      role_id: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/role_id must be/);
  });

  test("rejects a password shorter than 6 characters", async () => {
    const agent = await managerAgent();
    const res = await agent.post("/api/users/staff").set("X-Portal", "staff").send({
      email: "shortpw@test.local",
      password: "abc",
      full_name: "Short Pw",
      role_id: 4,
    });
    expect(res.status).toBe(400);
  });

  test("rejects a duplicate email with 400", async () => {
    const agent = await managerAgent();
    const body = { email: "dupe.staff@test.local", password: "Passw0rd!", full_name: "Dupe", role_id: 4 };
    const first = await agent.post("/api/users/staff").set("X-Portal", "staff").send(body);
    expect(first.status).toBe(201);

    const second = await agent.post("/api/users/staff").set("X-Portal", "staff").send(body);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe("Email already registered");
  });

  test("rejects a non-manager staff account with 403", async () => {
    const { agent } = await staffAgent("Supervisor", { email: "create.supervisor@test.local" });
    const res = await agent.post("/api/users/staff").set("X-Portal", "staff").send({
      email: "blocked@test.local",
      password: "Passw0rd!",
      full_name: "Blocked",
      role_id: 4,
    });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/users/staff/:id", () => {
  test("manager can update a staff member's details, including email", async () => {
    const target = await createUser("Cashier", { email: "before.update@test.local", full_name: "Before" });
    const agent = await managerAgent();

    const res = await agent.put(`/api/users/staff/${target.user_id}`).set("X-Portal", "staff").send({
      full_name: "After Update",
      phone_no: "0770001111",
      email: "after.update@test.local",
    });

    expect(res.status).toBe(200);
    expect(res.body.staff.full_name).toBe("After Update");

    const userRow = await prisma.user.findUnique({ where: { user_id: target.user_id } });
    expect(userRow.email).toBe("after.update@test.local");
  });

  test("requires full_name", async () => {
    const target = await createUser("Cashier", { email: "nofullname.update@test.local" });
    const agent = await managerAgent();
    const res = await agent.put(`/api/users/staff/${target.user_id}`).set("X-Portal", "staff").send({});
    expect(res.status).toBe(400);
  });

  test("returns 404 and rolls back the email change when the id is not a staff member", async () => {
    const customer = await createUser("Customer", { email: "rollback.customer@test.local" });
    const agent = await managerAgent();

    const res = await agent.put(`/api/users/staff/${customer.user_id}`).set("X-Portal", "staff").send({
      full_name: "Should Not Apply",
      email: "should.not.apply@test.local",
    });

    expect(res.status).toBe(404);

    // The email update happens before the staff-existence check inside the same
    // interactive transaction — throwing after it must roll the whole write back.
    const userRow = await prisma.user.findUnique({ where: { user_id: customer.user_id } });
    expect(userRow.email).toBe("rollback.customer@test.local");
  });

  test("rejects a non-manager staff account with 403", async () => {
    const target = await createUser("Cashier", { email: "rbacupdate.target@test.local" });
    const { agent } = await staffAgent("Supervisor", { email: "rbacupdate.supervisor@test.local" });
    const res = await agent.put(`/api/users/staff/${target.user_id}`).set("X-Portal", "staff").send({ full_name: "X" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/users/:id/status", () => {
  test("manager can deactivate and reactivate a staff account", async () => {
    const target = await createUser("Cashier", { email: "status.cashier@test.local" });
    const agent = await managerAgent();

    const deactivate = await agent
      .patch(`/api/users/${target.user_id}/status`)
      .set("X-Portal", "staff")
      .send({ account_status: "inactive" });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.user.account_status).toBe("inactive");

    const reactivate = await agent
      .patch(`/api/users/${target.user_id}/status`)
      .set("X-Portal", "staff")
      .send({ account_status: "active" });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.user.account_status).toBe("active");
  });

  test("rejects an invalid status value", async () => {
    const target = await createUser("Cashier", { email: "badstatus.cashier@test.local" });
    const agent = await managerAgent();
    const res = await agent
      .patch(`/api/users/${target.user_id}/status`)
      .set("X-Portal", "staff")
      .send({ account_status: "banned" });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a non-existent user id", async () => {
    const agent = await managerAgent();
    const res = await agent.patch("/api/users/999999/status").set("X-Portal", "staff").send({ account_status: "inactive" });
    expect(res.status).toBe(404);
  });

  // Despite the route doc saying "any user account", setAccountStatus queries
  // role_id IN [1,2,3,4] — a customer id is invisible to this endpoint.
  test("returns 404 for a customer id — this endpoint only reaches staff-role accounts", async () => {
    const customer = await createUser("Customer", { email: "statuscustomer@test.local" });
    const agent = await managerAgent();
    const res = await agent
      .patch(`/api/users/${customer.user_id}/status`)
      .set("X-Portal", "staff")
      .send({ account_status: "inactive" });
    expect(res.status).toBe(404);
  });

  test("rejects a non-manager staff account with 403", async () => {
    const target = await createUser("Cashier", { email: "rbacstatus.target@test.local" });
    const { agent } = await staffAgent("Supervisor", { email: "rbacstatus.supervisor@test.local" });
    const res = await agent
      .patch(`/api/users/${target.user_id}/status`)
      .set("X-Portal", "staff")
      .send({ account_status: "inactive" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/users/:id/reset-password", () => {
  test("manager can reset a staff member's password, and the new password works at login", async () => {
    const target = await createUser("Service Staff", { email: "resetpw.staff@test.local" });
    const agent = await managerAgent();

    const res = await agent
      .patch(`/api/users/${target.user_id}/reset-password`)
      .set("X-Portal", "staff")
      .send({ new_password: "brandnewpw" });
    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post("/api/auth/staff/login")
      .set("X-Portal", "staff")
      .send({ email: target.email, password: "brandnewpw" });
    expect(loginRes.status).toBe(200);
  });

  test("rejects a new_password shorter than 6 characters", async () => {
    const target = await createUser("Service Staff", { email: "shortresetpw.staff@test.local" });
    const agent = await managerAgent();
    const res = await agent
      .patch(`/api/users/${target.user_id}/reset-password`)
      .set("X-Portal", "staff")
      .send({ new_password: "abc" });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a customer id — this endpoint only reaches staff-role accounts", async () => {
    const customer = await createUser("Customer", { email: "resetpwcustomer@test.local" });
    const agent = await managerAgent();
    const res = await agent
      .patch(`/api/users/${customer.user_id}/reset-password`)
      .set("X-Portal", "staff")
      .send({ new_password: "brandnewpw" });
    expect(res.status).toBe(404);
  });

  test("rejects a non-manager staff account with 403", async () => {
    const target = await createUser("Service Staff", { email: "rbacresetpw.target@test.local" });
    const { agent } = await staffAgent("Supervisor", { email: "rbacresetpw.supervisor@test.local" });
    const res = await agent
      .patch(`/api/users/${target.user_id}/reset-password`)
      .set("X-Portal", "staff")
      .send({ new_password: "brandnewpw" });
    expect(res.status).toBe(403);
  });
});
