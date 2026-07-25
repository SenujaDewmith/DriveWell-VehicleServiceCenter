const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables } = require("./helpers/db");
const { createUser } = require("./helpers/auth");

beforeEach(async () => {
  await resetTransactionalTables();
});

// Minimal-but-valid PNG bytes (8-byte signature + a bit of filler) — multer's
// fileFilter only inspects the mimetype superagent derives from the filename
// extension in .attach(), it never decodes the image, so this is enough.
const pngBuffer = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

// This file needs an authenticated agent in nearly every test, and each test
// gets a brand-new user because resetTransactionalTables() runs in beforeEach.
// Going through the real POST /api/auth/login for every one of those would
// blow past loginLimiter's cap (20 requests / 15 min, shared by /login and
// /staff/login) well before the file finishes — that endpoint's actual login
// behavior is already covered end-to-end in auth.test.js. Here we mint the
// same JWT the controller would issue and attach it directly as a cookie,
// exercising verifyToken/authorizeRoles without touching the rate limiter.
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
    delete: (url) => request(app).delete(url).set(headers),
  };
}

async function customerAgent(overrides = {}) {
  const customer = await createUser("Customer", overrides);
  const agent = authedAgent(customer, "customer");
  return { customer, agent };
}

async function staffAgent(roleName = "Supervisor", overrides = {}) {
  const staff = await createUser(roleName, overrides);
  const agent = authedAgent(staff, "staff");
  return { staff, agent };
}

describe("PUT /api/profile", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).put("/api/profile").set("X-Portal", "customer").send({ full_name: "X" });
    expect(res.status).toBe(401);
  });

  test("updates the authenticated customer's own profile", async () => {
    const { customer, agent } = await customerAgent({ email: "update.customer@test.local" });

    const res = await agent
      .put("/api/profile")
      .set("X-Portal", "customer")
      .send({ full_name: "Sunil Bandara", phone: "0711234567", address: "12 Galle Rd, Colombo" });

    expect(res.status).toBe(200);
    expect(res.body.profile.full_name).toBe("Sunil Bandara");
    expect(res.body.profile.phone).toBe("0711234567");
    expect(res.body.profile.address).toBe("12 Galle Rd, Colombo");

    const row = await prisma.customer.findUnique({ where: { user_id: customer.user_id } });
    expect(row.full_name).toBe("Sunil Bandara");
  });

  test("updates the authenticated staff member's own profile using phone_no", async () => {
    const { staff, agent } = await staffAgent("Cashier", { email: "update.cashier@test.local" });

    const res = await agent
      .put("/api/profile")
      .set("X-Portal", "staff")
      .send({ full_name: "Chamara Perera", phone_no: "0719876543" });

    expect(res.status).toBe(200);
    expect(res.body.profile.full_name).toBe("Chamara Perera");
    expect(res.body.profile.phone_no).toBe("0719876543");

    const row = await prisma.staff.findUnique({ where: { user_id: staff.user_id } });
    expect(row.phone_no).toBe("0719876543");
  });

  test("requires full_name", async () => {
    const { agent } = await customerAgent({ email: "nofullname@test.local" });
    const res = await agent.put("/api/profile").set("X-Portal", "customer").send({ phone: "0711234567" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("full_name is required");
  });

  test("rejects an invalid secondary_phone", async () => {
    const { agent } = await customerAgent({ email: "badsecondary@test.local" });
    const res = await agent
      .put("/api/profile")
      .set("X-Portal", "customer")
      .send({ full_name: "Test Name", secondary_phone: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Enter a valid secondary phone number");
  });

  test("a partial update only touches the fields sent — omitted fields are preserved", async () => {
    const { agent } = await customerAgent({ email: "partial.update@test.local" });

    await agent
      .put("/api/profile")
      .set("X-Portal", "customer")
      .send({ full_name: "First Name", phone: "0711111111", address: "Original Address" });

    const res = await agent.put("/api/profile").set("X-Portal", "customer").send({ full_name: "Second Name" });

    expect(res.status).toBe(200);
    expect(res.body.profile.full_name).toBe("Second Name");
    expect(res.body.profile.phone).toBe("0711111111");
    expect(res.body.profile.address).toBe("Original Address");
  });

  test("never updates another user's profile — always scoped to req.user", async () => {
    const { customer: other } = await customerAgent({ email: "victim@test.local", full_name: "Victim Name" });
    const { agent } = await customerAgent({ email: "attacker@test.local" });

    const res = await agent.put("/api/profile").set("X-Portal", "customer").send({ full_name: "Attacker Name" });
    expect(res.status).toBe(200);

    const victimRow = await prisma.customer.findUnique({ where: { user_id: other.user_id } });
    expect(victimRow.full_name).toBe("Victim Name");
  });
});

describe("PUT /api/profile/change-password", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app)
      .put("/api/profile/change-password")
      .set("X-Portal", "customer")
      .send({ current_password: "Password@123", new_password: "NewPassword@123" });
    expect(res.status).toBe(401);
  });

  test("changes the password when the current password is correct", async () => {
    const { customer, agent } = await customerAgent({ email: "changepw@test.local" });

    const res = await agent
      .put("/api/profile/change-password")
      .set("X-Portal", "customer")
      .send({ current_password: customer.password, new_password: "NewPassword@123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password changed successfully");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("X-Portal", "customer")
      .send({ email: customer.email, password: "NewPassword@123" });
    expect(loginRes.status).toBe(200);
  });

  test("rejects an incorrect current password with 401", async () => {
    const { agent } = await customerAgent({ email: "wrongcurrent@test.local" });

    const res = await agent
      .put("/api/profile/change-password")
      .set("X-Portal", "customer")
      .send({ current_password: "NotTheRealPassword@1", new_password: "NewPassword@123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Current password is incorrect");
  });

  test("rejects reusing the same password", async () => {
    const { customer, agent } = await customerAgent({ email: "samepassword@test.local" });

    const res = await agent
      .put("/api/profile/change-password")
      .set("X-Portal", "customer")
      .send({ current_password: customer.password, new_password: customer.password });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("New password must be different from the current password");
  });

  test("rejects a new password that fails the strength policy", async () => {
    const { customer, agent } = await customerAgent({ email: "weaknew@test.local" });

    const res = await agent
      .put("/api/profile/change-password")
      .set("X-Portal", "customer")
      .send({ current_password: customer.password, new_password: "weak" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/profile/avatar", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app)
      .post("/api/profile/avatar")
      .set("X-Portal", "customer")
      .attach("avatar", pngBuffer(), "test.png");
    expect(res.status).toBe(401);
  });

  test("uploads an avatar for the authenticated customer", async () => {
    const { customer, agent } = await customerAgent({ email: "avatar.customer@test.local" });

    const res = await agent
      .post("/api/profile/avatar")
      .set("X-Portal", "customer")
      .attach("avatar", pngBuffer(), "test.png");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Avatar updated");
    expect(res.body.profile.avatar_url).toMatch(/^\/uploads\/avatars\//);

    const row = await prisma.customer.findUnique({ where: { user_id: customer.user_id } });
    expect(row.avatar_url).toBe(res.body.profile.avatar_url);
  });

  test("uploads an avatar for the authenticated staff member", async () => {
    const { staff, agent } = await staffAgent("Service Staff", { email: "avatar.staff@test.local" });

    const res = await agent
      .post("/api/profile/avatar")
      .set("X-Portal", "staff")
      .attach("avatar", pngBuffer(), "test.png");

    expect(res.status).toBe(200);
    const row = await prisma.staff.findUnique({ where: { user_id: staff.user_id } });
    expect(row.avatar_url).toBe(res.body.profile.avatar_url);
  });

  test("replacing an avatar stores a new file path", async () => {
    const { agent } = await customerAgent({ email: "avatar.replace@test.local" });

    const first = await agent
      .post("/api/profile/avatar")
      .set("X-Portal", "customer")
      .attach("avatar", pngBuffer(), "first.png");

    const second = await agent
      .post("/api/profile/avatar")
      .set("X-Portal", "customer")
      .attach("avatar", pngBuffer(), "second.png");

    expect(second.status).toBe(200);
    expect(second.body.profile.avatar_url).not.toBe(first.body.profile.avatar_url);
  });

  test("rejects a request with no file with 400", async () => {
    const { agent } = await customerAgent({ email: "avatar.nofile@test.local" });
    const res = await agent.post("/api/profile/avatar").set("X-Portal", "customer");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No image file uploaded");
  });

  test("rejects a disallowed mime type with 400", async () => {
    const { agent } = await customerAgent({ email: "avatar.badtype@test.local" });
    const res = await agent
      .post("/api/profile/avatar")
      .set("X-Portal", "customer")
      .attach("avatar", Buffer.from("not an image"), "notes.txt");
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/profile/avatar", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).delete("/api/profile/avatar").set("X-Portal", "customer");
    expect(res.status).toBe(401);
  });

  test("removes a previously uploaded avatar", async () => {
    const { customer, agent } = await customerAgent({ email: "avatar.remove@test.local" });
    await agent.post("/api/profile/avatar").set("X-Portal", "customer").attach("avatar", pngBuffer(), "test.png");

    const res = await agent.delete("/api/profile/avatar").set("X-Portal", "customer");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Avatar removed");
    expect(res.body.profile.avatar_url).toBeNull();

    const row = await prisma.customer.findUnique({ where: { user_id: customer.user_id } });
    expect(row.avatar_url).toBeNull();
  });

  test("is a no-op (still 200) when there was no avatar to remove", async () => {
    const { agent } = await customerAgent({ email: "avatar.noneremove@test.local" });
    const res = await agent.delete("/api/profile/avatar").set("X-Portal", "customer");
    expect(res.status).toBe(200);
    expect(res.body.profile.avatar_url).toBeNull();
  });
});
