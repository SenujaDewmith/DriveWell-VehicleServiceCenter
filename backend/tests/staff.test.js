const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");

beforeEach(async () => {
  await resetTransactionalTables();
});

let bookingRefCounter = 0;
const nextBookingRef = () => `BR${Date.now()}${bookingRefCounter++}`;

// vehicle_type_id 1 = Car, make_id 1 = Toyota, model_id 51 = Vitz — from
// prisma/seed-data/*.csv, loaded once by globalSetup and left alone by resetTransactionalTables().
async function createCustomerWithVehicle(fullName) {
  const customer = await createUser("Customer", { full_name: fullName || "Test Customer" });
  const vehicle = await prisma.vehicle.create({
    data: {
      customer_id: customer.user_id,
      make_id: 1,
      model_id: 51,
      vehicle_type_id: 1,
      year: 2020,
      plate_no: `WP-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    },
  });
  return { customer, vehicle };
}

// Builds a full reservation -> service_record -> service_staff_assignment(s) chain
// directly via Prisma (booking flow itself is out of scope for these dashboard tests).
async function createAssignedService({ staffIds, pkg, serviceDate, workNote, remarks, rating, comment, customerName }) {
  const { customer, vehicle } = await createCustomerWithVehicle(customerName);

  const reservation = await prisma.reservation.create({
    data: {
      booking_ref: nextBookingRef(),
      customer_id: customer.user_id,
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      start_time: new Date("1970-01-01T09:00:00.000Z"),
      end_time: new Date("1970-01-01T10:00:00.000Z"),
      service_date: new Date(serviceDate),
      status: "Completed",
    },
  });

  const record = await prisma.serviceRecord.create({
    data: { reservation_id: reservation.reservation_id, remarks: remarks ?? null },
  });

  for (const staffId of staffIds) {
    await prisma.serviceStaffAssignment.create({
      data: { record_id: record.record_id, staff_id: staffId, work_note: workNote ?? null },
    });
  }

  if (rating !== undefined) {
    await prisma.feedback.create({
      data: { reservation_id: reservation.reservation_id, customer_id: customer.user_id, rating, comment: comment ?? null },
    });
  }

  return { customer, vehicle, reservation, record };
}

describe("GET /api/staff/my-services", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/staff/my-services").set("X-Portal", "staff");
    expect(res.status).toBe(401);
  });

  test("rejects a non-Service-Staff role with 403", async () => {
    const supervisor = await createUser("Supervisor", { email: "myservices.supervisor@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, supervisor, "staff");
    const res = await agent.get("/api/staff/my-services").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("returns the authenticated staff member's assigned services with full detail", async () => {
    const staff = await createUser("Service Staff", { email: "myservices.staffa@test.local" });
    const pkg = await seedPackage({ name: "Full Service" });
    const { reservation } = await createAssignedService({
      staffIds: [staff.user_id],
      pkg,
      serviceDate: "2025-03-01",
      workNote: "Checked brake pads",
      remarks: "All good",
      rating: 5,
      comment: "Great service",
      customerName: "Kamal Silva",
    });

    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");
    const res = await agent.get("/api/staff/my-services").set("X-Portal", "staff");

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(1);
    const svc = res.body.services[0];
    expect(svc.reservation_id).toBe(reservation.reservation_id);
    expect(svc.booking_ref).toBe(reservation.booking_ref);
    expect(svc.service_date).toBe("2025-03-01");
    expect(svc.status).toBe("Completed");
    expect(svc.customer_name).toBe("Kamal Silva");
    expect(svc.make).toBe("Toyota");
    expect(svc.model).toBe("Vitz");
    expect(svc.package_name).toBe("Full Service");
    expect(svc.work_note).toBe("Checked brake pads");
    expect(svc.remarks).toBe("All good");
    expect(svc.rating).toBe(5);
    expect(svc.feedback_comment).toBe("Great service");
  });

  test("is scoped to the logged-in staff member's own assignments only", async () => {
    const staffA = await createUser("Service Staff", { email: "isolation.staffa@test.local" });
    const staffB = await createUser("Service Staff", { email: "isolation.staffb@test.local" });
    const pkg = await seedPackage();

    const { reservation: reservationA } = await createAssignedService({
      staffIds: [staffA.user_id],
      pkg,
      serviceDate: "2025-04-01",
    });
    const { reservation: reservationB } = await createAssignedService({
      staffIds: [staffB.user_id],
      pkg,
      serviceDate: "2025-04-02",
    });

    const agentA = request.agent(app);
    await loginAs(agentA, staffA, "staff");
    const resA = await agentA.get("/api/staff/my-services").set("X-Portal", "staff");
    expect(resA.body.services.map((s) => s.reservation_id)).toEqual([reservationA.reservation_id]);

    const agentB = request.agent(app);
    await loginAs(agentB, staffB, "staff");
    const resB = await agentB.get("/api/staff/my-services").set("X-Portal", "staff");
    expect(resB.body.services.map((s) => s.reservation_id)).toEqual([reservationB.reservation_id]);
  });

  test("filters by service date range using from/to query params", async () => {
    const staff = await createUser("Service Staff", { email: "datefilter.staff@test.local" });
    const pkg = await seedPackage();

    const { reservation: earlyRes } = await createAssignedService({ staffIds: [staff.user_id], pkg, serviceDate: "2025-01-10" });
    const { reservation: lateRes } = await createAssignedService({ staffIds: [staff.user_id], pkg, serviceDate: "2025-06-10" });

    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");
    const res = await agent
      .get("/api/staff/my-services")
      .query({ from: "2025-05-01", to: "2025-12-31" })
      .set("X-Portal", "staff");

    expect(res.status).toBe(200);
    const ids = res.body.services.map((s) => s.reservation_id);
    expect(ids).toContain(lateRes.reservation_id);
    expect(ids).not.toContain(earlyRes.reservation_id);
  });
});

describe("GET /api/staff/my-performance", () => {
  test("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/staff/my-performance").set("X-Portal", "staff");
    expect(res.status).toBe(401);
  });

  test("rejects a non-Service-Staff role with 403", async () => {
    const cashier = await createUser("Cashier", { email: "myperf.cashier@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, cashier, "staff");
    const res = await agent.get("/api/staff/my-performance").set("X-Portal", "staff");
    expect(res.status).toBe(403);
  });

  test("returns zeroed-out performance when the staff member has no assignments", async () => {
    const staff = await createUser("Service Staff", { email: "noassignments.staff@test.local" });
    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");

    const res = await agent.get("/api/staff/my-performance").set("X-Portal", "staff");

    expect(res.status).toBe(200);
    expect(res.body.performance).toEqual({
      jobs_completed: 0,
      avg_rating: null,
      feedback_count: 0,
      first_service: null,
      last_service: null,
    });
    expect(res.body.rating_breakdown).toEqual([]);
  });

  test("computes jobs completed, average rating, and rating breakdown", async () => {
    const staff = await createUser("Service Staff", { email: "performance.staff@test.local" });
    const pkg = await seedPackage();

    await createAssignedService({ staffIds: [staff.user_id], pkg, serviceDate: "2025-02-01", rating: 4 });
    await createAssignedService({ staffIds: [staff.user_id], pkg, serviceDate: "2025-05-01", rating: 5 });

    const agent = request.agent(app);
    await loginAs(agent, staff, "staff");
    const res = await agent.get("/api/staff/my-performance").set("X-Portal", "staff");

    expect(res.status).toBe(200);
    expect(res.body.performance.jobs_completed).toBe(2);
    expect(res.body.performance.feedback_count).toBe(2);
    expect(res.body.performance.avg_rating).toBe(4.5);
    expect(res.body.performance.first_service).toBe("2025-02-01");
    expect(res.body.performance.last_service).toBe("2025-05-01");
    expect(res.body.rating_breakdown).toEqual([
      { rating: 5, count: 1 },
      { rating: 4, count: 1 },
    ]);
  });

  test("is scoped to the logged-in staff member's own assignments only", async () => {
    const staffA = await createUser("Service Staff", { email: "isolationperf.staffa@test.local" });
    const staffB = await createUser("Service Staff", { email: "isolationperf.staffb@test.local" });
    const pkg = await seedPackage();

    await createAssignedService({ staffIds: [staffA.user_id], pkg, serviceDate: "2025-03-01", rating: 3 });
    await createAssignedService({ staffIds: [staffB.user_id], pkg, serviceDate: "2025-03-02", rating: 5 });

    const agentA = request.agent(app);
    await loginAs(agentA, staffA, "staff");
    const resA = await agentA.get("/api/staff/my-performance").set("X-Portal", "staff");
    expect(resA.body.performance.jobs_completed).toBe(1);
    expect(resA.body.performance.avg_rating).toBe(3);

    const agentB = request.agent(app);
    await loginAs(agentB, staffB, "staff");
    const resB = await agentB.get("/api/staff/my-performance").set("X-Portal", "staff");
    expect(resB.body.performance.jobs_completed).toBe(1);
    expect(resB.body.performance.avg_rating).toBe(5);
  });
});
