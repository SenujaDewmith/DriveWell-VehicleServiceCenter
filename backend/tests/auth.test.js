const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

beforeEach(async () => {
  await resetTransactionalTables();
});

const validRegisterBody = (overrides = {}) => ({
  name: "Nimal Perera",
  email: "nimal.perera@test.local",
  password: "Password@123",
  ...overrides,
});

describe("POST /api/auth/register", () => {
  test("registers a new customer account and creates a Customer role row", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegisterBody());

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(res.body.user.email).toBe("nimal.perera@test.local");
    expect(res.body.user.role_id).toBe(5);
    expect(res.body.user.user_id).toBeDefined();

    const customer = await prisma.customer.findUnique({ where: { user_id: res.body.user.user_id } });
    expect(customer.full_name).toBe("Nimal Perera");
  });

  test("rejects duplicate email registration", async () => {
    const body = validRegisterBody({ email: "duplicate@test.local" });
    const first = await request(app).post("/api/auth/register").send(body);
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/auth/register").send(body);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe("Email already registered");
  });

  test("rejects a name shorter than 2 characters", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegisterBody({ name: "N" }));
    expect(res.status).toBe(400);
  });

  test("rejects an invalid email format", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegisterBody({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  test("rejects a password that fails the strength policy", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegisterBody({ password: "weak" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  test("logs in an active customer and sets the customer_token cookie", async () => {
    const customer = await createUser("Customer", { email: "login.customer@test.local" });

    const res = await request(app).post("/api/auth/login").set("X-Portal", "customer").send({
      email: customer.email,
      password: customer.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.user).toEqual({ id: customer.user_id, email: customer.email, role_id: 5 });
    const cookies = res.headers["set-cookie"];
    expect(cookies.some((c) => c.startsWith("customer_token="))).toBe(true);
  });

  test("rejects an incorrect password with 401", async () => {
    const customer = await createUser("Customer", { email: "wrongpass@test.local" });

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: customer.email, password: "WrongPassword@1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  test("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: "nobody@test.local", password: "Password@123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  test("rejects an inactive account with 403", async () => {
    const customer = await createUser("Customer", {
      email: "inactive.customer@test.local",
      account_status: "inactive",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: customer.email, password: customer.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Account is inactive. Contact the service center.");
  });

  test("rejects a staff account with a wrong-portal message", async () => {
    const staff = await createUser("Cashier", { email: "cashier.viacustomer@test.local" });

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: staff.email, password: staff.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This portal is for customers only. Staff should use the staff login.");
  });

  test("rememberMe sets a 30-day cookie instead of the default 1-day cookie", async () => {
    const customer = await createUser("Customer", { email: "remember.me@test.local" });

    const remembered = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: customer.email, password: customer.password, rememberMe: true });
    const rememberedCookie = remembered.headers["set-cookie"].find((c) => c.startsWith("customer_token="));
    expect(rememberedCookie).toMatch(/Max-Age=2592000/);

    const normal = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: customer.email, password: customer.password });
    const normalCookie = normal.headers["set-cookie"].find((c) => c.startsWith("customer_token="));
    expect(normalCookie).toMatch(/Max-Age=86400/);
  });
});

describe("POST /api/auth/staff/login", () => {
  test("logs in an active staff account and sets the staff_token cookie", async () => {
    const supervisor = await createUser("Supervisor", { email: "login.supervisor@test.local" });

    const res = await request(app)
      .post("/api/auth/staff/login")
      .set("X-Portal", "staff")
      .send({ email: supervisor.email, password: supervisor.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: supervisor.user_id, email: supervisor.email, role_id: 2 });
    const cookies = res.headers["set-cookie"];
    expect(cookies.some((c) => c.startsWith("staff_token="))).toBe(true);
  });

  test("rejects a customer account with a wrong-portal message", async () => {
    const customer = await createUser("Customer", { email: "customer.viastaff@test.local" });

    const res = await request(app)
      .post("/api/auth/staff/login")
      .set("X-Portal", "staff")
      .send({ email: customer.email, password: customer.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This portal is for service center staff only.");
  });

  test("rejects an inactive staff account with 403", async () => {
    const staff = await createUser("Service Staff", {
      email: "inactive.staff@test.local",
      account_status: "inactive",
    });

    const res = await request(app)
      .post("/api/auth/staff/login")
      .set("X-Portal", "staff")
      .send({ email: staff.email, password: staff.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Account is inactive. Contact the service center.");
  });
});

describe("POST /api/auth/logout and /api/auth/staff/logout", () => {
  test("clears the customer_token cookie", async () => {
    const customer = await createUser("Customer", { email: "logout.customer@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, customer, "customer");

    const res = await agent.post("/api/auth/logout").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
    const cookie = res.headers["set-cookie"].find((c) => c.startsWith("customer_token="));
    expect(cookie).toMatch(/customer_token=;/);
  });

  test("clears the staff_token cookie", async () => {
    const staff = await createUser("Cashier", { email: "logout.staff@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");

    const res = await agent.post("/api/auth/staff/logout").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    const cookie = res.headers["set-cookie"].find((c) => c.startsWith("staff_token="));
    expect(cookie).toMatch(/staff_token=;/);
  });
});

describe("GET /api/auth/profile", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/auth/profile").set("X-Portal", "customer");
    expect(res.status).toBe(401);
  });

  test("returns the customer profile shape for a customer account", async () => {
    const customer = await createUser("Customer", {
      email: "profile.customer@test.local",
      full_name: "Kamal Fernando",
      phone: "0771234567",
    });
    const agent = request.agent(app);
    await loginAs(agent, customer, "customer");

    const res = await agent.get("/api/auth/profile").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(customer.email);
    expect(res.body.user.role_id).toBe(5);
    expect(res.body.user.account_status).toBe("active");
    expect(res.body.profile.full_name).toBe("Kamal Fernando");
    expect(res.body.profile.phone).toBe("0771234567");
  });

  test("returns the staff profile shape for a staff account", async () => {
    const staff = await createUser("Supervisor", {
      email: "profile.staff@test.local",
      full_name: "Ruwan Silva",
    });
    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");

    const res = await agent.get("/api/auth/profile").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.user.role_id).toBe(2);
    expect(res.body.profile.full_name).toBe("Ruwan Silva");
    // Staff profile has no `phone`/`address` fields — those are customer-only.
    expect(res.body.profile.phone).toBeUndefined();
  });
});
