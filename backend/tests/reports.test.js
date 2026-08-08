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

async function managerAgent() {
  const manager = await createUser("Service Center Manager");
  return agentFor(manager, "staff");
}

describe("GET /api/reports/revenue", () => {
  test("summarizes revenue from paid and unpaid invoices", async () => {
    const pkg = await seedPackage({ price: 5000, name: "Standard Service" });
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });

    const cashier = await createUser("Cashier");
    const cashierAgent = await agentFor(cashier, "staff");
    const created = await cashierAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    await cashierAgent.patch(`/api/invoices/${created.body.invoice.invoice_id}/payment`).set("X-Portal", "staff").send({ payment_status: "Paid" });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/revenue").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(Number(res.body.summary.total_revenue)).toBe(5000);
    expect(Number(res.body.summary.paid_revenue)).toBe(5000);
    expect(Number(res.body.summary.unpaid_revenue)).toBe(0);
    expect(res.body.by_package[0].package_name).toBe("Standard Service");
  });

  test("403 for a non-manager", async () => {
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.get("/api/reports/revenue").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const res = await request(app).get("/api/reports/revenue");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/reports/volume", () => {
  test("groups active bookings by status and package, excluding Cancelled/No-show", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });
    await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Cancelled" });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/volume").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    const completedRow = res.body.by_status.find((r) => r.status === "Completed");
    expect(Number(completedRow.count)).toBe(1);
    expect(res.body.by_status.find((r) => r.status === "Cancelled")).toBeUndefined();
  });
});

describe("GET /api/reports/staff-performance", () => {
  test("counts jobs completed and average rating per staff member", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });

    const svcStaff = await createUser("Service Staff", { full_name: "Nimal Perera" });
    const record = await prisma.serviceRecord.create({ data: { reservation_id: reservation.reservation_id } });
    await prisma.serviceStaffAssignment.create({ data: { record_id: record.record_id, staff_id: svcStaff.user_id } });
    await prisma.feedback.create({ data: { reservation_id: reservation.reservation_id, customer_id: customer.user_id, rating: 4 } });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/staff-performance").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    const row = res.body.staff_performance.find((r) => r.staff_id === svcStaff.user_id);
    expect(row.full_name).toBe("Nimal Perera");
    expect(Number(row.jobs_completed)).toBe(1);
    expect(Number(row.avg_rating)).toBe(4);
  });
});

describe("GET /api/reports/revenue/pdf", () => {
  test("returns a real PDF with revenue data baked in", async () => {
    const pkg = await seedPackage({ price: 5000, name: "Standard Service" });
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });

    const cashier = await createUser("Cashier");
    const cashierAgent = await agentFor(cashier, "staff");
    const created = await cashierAgent.post("/api/invoices").set("X-Portal", "staff").send({ reservation_id: reservation.reservation_id, base_amount: 5000 });
    await cashierAgent.patch(`/api/invoices/${created.body.invoice.invoice_id}/payment`).set("X-Portal", "staff").send({ payment_status: "Paid" });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/revenue/pdf").set("X-Portal", "staff").buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("drivewell-revenue-report.pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(res.body.length).toBeGreaterThan(1000);
  });

  test("403 for a non-manager", async () => {
    const cashier = await createUser("Cashier");
    const agent = await agentFor(cashier, "staff");
    const res = await agent.get("/api/reports/revenue/pdf").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/reports/volume/pdf", () => {
  test("returns a real PDF", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/volume/pdf").set("X-Portal", "staff").buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("GET /api/reports/staff-performance/pdf", () => {
  test("returns a real PDF", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({ customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed" });

    const svcStaff = await createUser("Service Staff", { full_name: "Nimal Perera" });
    const record = await prisma.serviceRecord.create({ data: { reservation_id: reservation.reservation_id } });
    await prisma.serviceStaffAssignment.create({ data: { record_id: record.record_id, staff_id: svcStaff.user_id } });
    await prisma.feedback.create({ data: { reservation_id: reservation.reservation_id, customer_id: customer.user_id, rating: 4 } });

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/staff-performance/pdf").set("X-Portal", "staff").buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("GET /api/reports/activity/pdf", () => {
  test("returns a real PDF", async () => {
    const agent = await managerAgent();
    const res = await agent.get("/api/reports/activity/pdf").set("X-Portal", "staff").buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("403 for a non-manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = await agentFor(supervisor, "staff");
    const res = await agent.get("/api/reports/activity/pdf").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/reports/activity", () => {
  test("logs a booking creation and returns it in the activity feed", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const customerAgent = await agentFor(customer, "customer");
    const { nextWorkingDate } = require("./helpers/booking");

    await customerAgent.post("/api/bookings").set("X-Portal", "customer").send({
      vehicle_id: vehicle.vehicle_id, package_id: pkg.package_id, service_date: nextWorkingDate(),
      start_time: "09:00", terms_accepted: true, terms_version: "1.0",
    });
    // logActivity is fire-and-forget (not awaited by the controller) — give it a beat to land.
    await new Promise((r) => setTimeout(r, 300));

    const agent = await managerAgent();
    const res = await agent.get("/api/reports/activity").set("X-Portal", "staff");
    expect(res.status).toBe(200);
    expect(res.body.logs.some((l) => l.action === "BOOKING_CREATED")).toBe(true);
  });

  test("403 for a non-manager", async () => {
    const supervisor = await createUser("Supervisor");
    const agent = await agentFor(supervisor, "staff");
    const res = await agent.get("/api/reports/activity").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });
});
