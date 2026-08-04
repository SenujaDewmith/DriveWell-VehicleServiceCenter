const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { createVehicle, createReservation } = require("./helpers/booking");
const prisma = require("../src/lib/prisma");

beforeEach(async () => {
  await resetTransactionalTables();
});

async function agentFor(user, portal) {
  const agent = request.agent(app);
  await loginAs(agent, user, portal);
  return agent;
}

async function completedBookingFixture() {
  const pkg = await seedPackage({ price: 5000 });
  const customer = await createUser("Customer");
  const vehicle = await createVehicle(customer.user_id);
  const reservation = await createReservation({
    customerId: customer.user_id,
    vehicleId: vehicle.vehicle_id,
    packageId: pkg.package_id,
    estimatedDuration: pkg.estimated_duration,
    status: "Completed",
  });
  return { pkg, customer, vehicle, reservation };
}

describe("POST /api/invoices", () => {
  test("cashier generates an invoice with items and computes totals correctly", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");

    const res = await agent.post("/api/invoices").set("X-Portal", "staff").send({
      reservation_id: reservation.reservation_id,
      base_amount: 5000,
      discount: 500,
      items: [
        { description: "Brake pads", unit_price: 1500, quantity: 2 },
        { description: "Air filter", unit_price: 800, quantity: 1 },
      ],
    });

    expect(res.status).toBe(201);
    // additional_charges = 1500*2 + 800*1 = 3800; total = 5000 + 3800 - 500 = 8300
    expect(Number(res.body.invoice.additional_charges)).toBe(3800);
    expect(Number(res.body.invoice.total_amount)).toBe(8300);
    expect(res.body.invoice.items).toHaveLength(2);
  });

  test("400 when the booking is not Completed", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Booked",
    });
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");

    const res = await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    expect(res.status).toBe(400);
  });

  test("400 when reservation_id or base_amount is missing", async () => {
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.post("/api/invoices").set("X-Portal", "staff").send({ base_amount: 5000 });
    expect(res.status).toBe(400);
  });

  test("400 when an item is missing description or unit_price", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.post("/api/invoices").set("X-Portal", "staff").send({
      reservation_id: reservation.reservation_id, base_amount: 5000, items: [{ quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });

  test("400 when an invoice already exists for the booking", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    const res = await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    expect(res.status).toBe(400);
  });

  test("403 for a customer or supervisor trying to generate an invoice", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const customerAgent = await agentFor(customer, "customer");
    const customerRes = await customerAgent.post("/api/invoices").set("X-Portal", "customer").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    expect(customerRes.status).toBe(403);

    const supervisor = await createUser("Supervisor");
    const supervisorAgent = await agentFor(supervisor, "staff");
    const supervisorRes = await supervisorAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    expect(supervisorRes.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const res = await request(app).post("/api/invoices").send({ reservation_id: 1, base_amount: 5000 });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/invoices and /api/invoices/:id", () => {
  test("customer sees only their own invoices; cashier sees all", async () => {
    const { reservation, customer } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const cashierAgent = await agentFor(cashier, "staff");
    await cashierAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    const ownerAgent = await agentFor(customer, "customer");
    const ownRes = await ownerAgent.get("/api/invoices").set("X-Portal", "customer");
    expect(ownRes.body.invoices).toHaveLength(1);

    const otherCustomer = await createUser("Customer", { email: "other-inv@test.local" });
    const otherAgent = await agentFor(otherCustomer, "customer");
    const otherRes = await otherAgent.get("/api/invoices").set("X-Portal", "customer");
    expect(otherRes.body.invoices).toHaveLength(0);

    const cashierListRes = await cashierAgent.get("/api/invoices").set("X-Portal", "staff");
    expect(cashierListRes.body.invoices).toHaveLength(1);
  });

  test("hides supervisor remarks/items from the customer view but includes them for staff", async () => {
    const { reservation, customer } = await completedBookingFixture();
    await prisma.serviceRecord.create({
      data: {
        reservation_id: reservation.reservation_id,
        remarks: "Found a small oil leak",
        items: { create: [{ description: "Replace gasket", quantity: 1 }] },
      },
    });
    const cashier = await createUser("Cashier");
    const cashierAgent = await agentFor(cashier, "staff");
    const created = await cashierAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    const invoiceId = created.body.invoice.invoice_id;

    const staffView = await cashierAgent.get(`/api/invoices/${invoiceId}`).set("X-Portal", "staff");
    expect(staffView.body.invoice.supervisor_remarks).toBe("Found a small oil leak");
    expect(staffView.body.invoice.supervisor_items).toHaveLength(1);

    const customerAgent = await agentFor(customer, "customer");
    const customerView = await customerAgent.get(`/api/invoices/${invoiceId}`).set("X-Portal", "customer");
    expect(customerView.body.invoice.supervisor_remarks).toBeUndefined();
    expect(customerView.body.invoice.supervisor_items).toBeUndefined();
  });

  test("403 when a customer requests another customer's invoice", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const cashierAgent = await agentFor(cashier, "staff");
    const created = await cashierAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    const intruder = await createUser("Customer", { email: "invoice-intruder@test.local" });
    const intruderAgent = await agentFor(intruder, "customer");
    const res = await intruderAgent.get(`/api/invoices/${created.body.invoice.invoice_id}`).set("X-Portal", "customer");
    expect(res.status).toBe(403);
  });

  test("404 for a non-existent invoice", async () => {
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.get("/api/invoices/999999").set("X-Portal", "staff");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/invoices/draft/:booking_id", () => {
  test("returns package price and suggested items for the cashier to build an invoice from", async () => {
    const { reservation, pkg } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.get(`/api/invoices/draft/${reservation.reservation_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(Number(res.body.package_price)).toBe(Number(pkg.price));
  });

  test("403 for a non-cashier/manager", async () => {
    const { reservation } = await completedBookingFixture();
    const supervisor = await createUser("Supervisor");
    const agent = await agentFor(supervisor, "staff");
    const res = await agent.get(`/api/invoices/draft/${reservation.reservation_id}`).set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/invoices/:id/payment", () => {
  test("marks an invoice as Paid", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const created = await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    const res = await agent.patch(`/api/invoices/${created.body.invoice.invoice_id}/payment`).set("X-Portal", "staff").send({ payment_status: "Paid", payment_method: "Cash" });
    expect(res.status).toBe(200);
    expect(res.body.invoice.payment_status).toBe("Paid");
  });

  test("does not change the reservation's status when payment is marked Paid — Completed stays Completed", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const created = await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    await agent.patch(`/api/invoices/${created.body.invoice.invoice_id}/payment`).set("X-Portal", "staff").send({ payment_status: "Paid" });

    const updated = await prisma.reservation.findUnique({ where: { reservation_id: reservation.reservation_id } });
    expect(updated.status).toBe("Completed");
  });

  test("400 for an invalid payment_status", async () => {
    const { reservation } = await completedBookingFixture();
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const created = await agent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });

    const res = await agent.patch(`/api/invoices/${created.body.invoice.invoice_id}/payment`).set("X-Portal", "staff").send({ payment_status: "Refunded" });
    expect(res.status).toBe(400);
  });

  test("404 for a non-existent invoice", async () => {
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.patch("/api/invoices/999999/payment").set("X-Portal", "staff").send({ payment_status: "Paid" });
    expect(res.status).toBe(404);
  });

  test("403 for a non-cashier/manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = await agentFor(supervisor, "staff");
    const res = await agent.patch("/api/invoices/1/payment").set("X-Portal", "staff").send({ payment_status: "Paid" });
    expect(res.status).toBe(403);
  });
});
