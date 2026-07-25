const bcrypt = require("bcryptjs");
const prisma = require("../../src/lib/prisma");

// Matches src/middlewares/auth.middleware.js ROLE_MAP.
const ROLE_NAME_TO_ID = {
  "Service Center Manager": 1,
  Supervisor: 2,
  Cashier: 3,
  "Service Staff": 4,
  Customer: 5,
};

const DEFAULT_PASSWORD = "Password@123"; // meets backend/src/schemas/auth.schema.js passwordSchema

let counter = 0;

// Creates a user directly via Prisma (fast, deterministic) rather than through
// POST /api/auth/register — registration is exercised for real in auth.test.js.
// Returns the plaintext password alongside the row so callers can log in.
async function createUser(roleName, overrides = {}) {
  const role = await prisma.role.findUnique({ where: { role_name: roleName } });
  if (!role) throw new Error(`Unknown role: ${roleName}`);

  const password = overrides.password || DEFAULT_PASSWORD;
  const password_hash = await bcrypt.hash(password, 10);
  counter += 1;
  const email = overrides.email || `${roleName.toLowerCase().replace(/[^a-z]+/g, ".")}.${Date.now()}.${counter}@test.local`;
  const isCustomer = roleName === "Customer";

  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      role_id: role.role_id,
      account_status: overrides.account_status || "active",
      ...(isCustomer
        ? { customer: { create: { full_name: overrides.full_name || "Test Customer", phone: overrides.phone } } }
        : { staff: { create: { full_name: overrides.full_name || `Test ${roleName}` } } }),
    },
  });

  return { ...user, email, password };
}

// Logs in through the real endpoint (exercises the actual auth flow) and
// returns the supertest agent with the session cookie attached for reuse.
// portal must be "customer" or "staff" — matches X-Portal header handling in
// src/middlewares/auth.middleware.js (tokenFromRequest).
async function loginAs(agent, { email, password }, portal) {
  const path = portal === "staff" ? "/api/auth/staff/login" : "/api/auth/login";
  const res = await agent.post(path).set("X-Portal", portal).send({ email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${email}, ${portal}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

module.exports = { createUser, loginAs, ROLE_NAME_TO_ID, DEFAULT_PASSWORD };
