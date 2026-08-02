const request = require("supertest");
const app = require("./helpers/app");
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { nextWorkingDate, createVehicle, createReservation } = require("./helpers/booking");

beforeEach(async () => {
  await resetTransactionalTables();
});

async function customerAgent(overrides = {}) {
  const customer = await createUser("Customer", overrides);
  const agent = request.agent(app);
  await loginAs(agent, customer, "customer");
  return { customer, agent };
}

async function staffAgent(role) {
  const staff = await createUser(role);
  const agent = request.agent(app);
  await loginAs(agent, staff, "staff");
  return { staff, agent };
}

const withPortal = (agent, portal) => (method, path) => agent[method](path).set("X-Portal", portal);

describe("GET /api/bookings/available-slots", () => {
  test("returns package-aware windows with lunch break excluded and full capacity", async () => {
    const pkg = await seedPackage({ estimated_duration: 60, max_capacity: 2 });
    const { agent } = await customerAgent();
    const date = nextWorkingDate();

    const res = await withPortal(agent, "customer")("get", `/api/bookings/available-slots?date=${date}&package_id=${pkg.package_id}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.slots.some((s) => s.start_time === "09:00")).toBe(true);
    expect(res.body.slots.every((s) => !(s.start_time < "13:00" && s.end_time > "12:00") || s.start_time === "12:00")).toBe(true);
    const noon = res.body.slots.find((s) => s.start_time === "12:00");
    expect(noon).toBeUndefined(); // lunch-break window is skipped entirely
    const nine = res.body.slots.find((s) => s.start_time === "09:00");
    expect(nine.capacity).toBe(2);
    expect(nine.remaining).toBe(2);
  });

  test("400 when date or package_id missing", async () => {
    const { agent } = await customerAgent();
    const res = await withPortal(agent, "customer")("get", "/api/bookings/available-slots?date=2026-01-05");
    expect(res.status).toBe(400);
  });

  test("401 when not authenticated", async () => {
    const res = await request(app).get("/api/bookings/available-slots?date=2026-01-05&package_id=1");
    expect(res.status).toBe(401);
  });

  test("not a working day returns available:false without slots", async () => {
    const pkg = await seedPackage();
    const { agent } = await customerAgent();
    // Find the next Saturday
    const d = new Date();
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    const saturday = d.toISOString().split("T")[0];

    const res = await withPortal(agent, "customer")("get", `/api/bookings/available-slots?date=${saturday}&package_id=${pkg.package_id}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.slots).toEqual([]);
  });
});

describe("GET /api/bookings/calendar", () => {
  test("returns day-level status for every day in the month", async () => {
    const pkg = await seedPackage();
    const { agent } = await customerAgent();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const res = await withPortal(agent, "customer")("get", `/api/bookings/calendar?year=${year}&month=${month}&package_id=${pkg.package_id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days.length).toBeGreaterThanOrEqual(28);
    expect(res.body.days.every((d) => ["available", "limited", "full", "closed"].includes(d.status))).toBe(true);
  });
});

describe("POST /api/bookings", () => {
  test("customer creates a booking successfully", async () => {
    const pkg = await seedPackage({ estimated_duration: 60 });
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const date = nextWorkingDate();

    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: date,
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    expect(res.status).toBe(201);
    expect(res.body.booking_ref).toMatch(/^DW-\d{4}-\d{5}$/);
    expect(res.body.reservation_id).toBeDefined();
  });

  test("403 when a non-customer (staff) tries to book", async () => {
    const pkg = await seedPackage();
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent, "staff")("post", "/api/bookings").send({
      vehicle_id: 1,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const res = await request(app).post("/api/bookings").send({});
    expect(res.status).toBe(401);
  });

  test("400 when terms are not accepted", async () => {
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: false,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Terms/i);
  });

  test("400 when terms_version is stale", async () => {
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "0.9",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/updated/i);
  });

  test("400 when the vehicle does not belong to the customer", async () => {
    const pkg = await seedPackage();
    const { customer: owner } = await customerAgent();
    const vehicle = await createVehicle(owner.user_id);
    const { agent: otherAgent } = await customerAgent({ email: "other.customer@test.local" });

    const res = await withPortal(otherAgent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
  });

  test("400 when the date is not a working day", async () => {
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const d = new Date();
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    const saturday = d.toISOString().split("T")[0];

    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: saturday,
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/working day/i);
  });

  test("400 when the date is in the past", async () => {
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);

    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: "2024-01-01", // a Monday
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/past/i);
  });

  test("400 when the time does not fit business hours", async () => {
    const pkg = await seedPackage({ estimated_duration: 60 });
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);

    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "17:30",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/business hours/i);
  });

  test("400 when the time overlaps the lunch-break blocked period", async () => {
    const pkg = await seedPackage({ estimated_duration: 60 });
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);

    const res = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "12:30",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/blocked/i);
  });

  test("enforces the package's max_capacity for overlapping bookings", async () => {
    const pkg = await seedPackage({ estimated_duration: 60, max_capacity: 2 });
    const date = nextWorkingDate();

    const makeBooking = async (emailSuffix) => {
      const { customer, agent } = await customerAgent({ email: `cap.${emailSuffix}@test.local` });
      const vehicle = await createVehicle(customer.user_id);
      return withPortal(agent, "customer")("post", "/api/bookings").send({
        vehicle_id: vehicle.vehicle_id,
        package_id: pkg.package_id,
        service_date: date,
        start_time: "09:00",
        terms_accepted: true,
        terms_version: "1.0",
      });
    };

    const first = await makeBooking(1);
    const second = await makeBooking(2);
    const third = await makeBooking(3);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(400);
    expect(third.body.message).toMatch(/fully booked/i);
  });
});

describe("GET /api/bookings and /api/bookings/:id", () => {
  test("customer only sees their own bookings", async () => {
    const pkg = await seedPackage();
    const { customer: c1, agent: a1 } = await customerAgent({ email: "c1@test.local" });
    const v1 = await createVehicle(c1.user_id);
    const created = await withPortal(a1, "customer")("post", "/api/bookings").send({
      vehicle_id: v1.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });
    expect(created.status).toBe(201);

    const { agent: a2 } = await customerAgent({ email: "c2@test.local" });
    const listRes = await withPortal(a2, "customer")("get", "/api/bookings");
    expect(listRes.status).toBe(200);
    expect(listRes.body.bookings).toHaveLength(0);

    const ownListRes = await withPortal(a1, "customer")("get", "/api/bookings");
    expect(ownListRes.body.bookings).toHaveLength(1);
  });

  test("staff sees all bookings", async () => {
    const pkg = await seedPackage();
    const { customer, agent: customerA } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    await withPortal(customerA, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const { agent: staffA } = await staffAgent("Supervisor");
    const res = await withPortal(staffA, "staff")("get", "/api/bookings");
    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
  });

  test("403 when a customer tries to view another customer's booking", async () => {
    const pkg = await seedPackage();
    const { customer, agent: ownerAgent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const created = await withPortal(ownerAgent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const { agent: otherAgent } = await customerAgent({ email: "intruder@test.local" });
    const res = await withPortal(otherAgent, "customer")("get", `/api/bookings/${created.body.reservation_id}`);
    expect(res.status).toBe(403);
  });

  test("404 for a non-existent booking", async () => {
    const { agent } = await staffAgent("Service Center Manager");
    const res = await withPortal(agent, "staff")("get", "/api/bookings/999999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/bookings?vehicle_id — vehicle-scoped service history", () => {
  // Simulates a vehicle that's changed hands: previousOwner books and completes a service,
  // then the vehicle is claimed by newOwner (direct prisma write — same effect as
  // POST /api/vehicles/claim, without re-exercising that flow here).
  async function claimedVehicleWithHistory() {
    const pkg = await seedPackage();
    const { customer: previousOwner, agent: previousAgent } = await customerAgent({ email: "previous@test.local" });
    const { customer: newOwner, agent: newAgent } = await customerAgent({ email: "new@test.local" });
    const vehicle = await createVehicle(previousOwner.user_id);
    const reservation = await createReservation({
      customerId: previousOwner.user_id,
      vehicleId: vehicle.vehicle_id,
      packageId: pkg.package_id,
      estimatedDuration: pkg.estimated_duration,
      status: "Completed",
    });
    await prisma.vehicle.update({
      where: { vehicle_id: vehicle.vehicle_id },
      data: { customer_id: newOwner.user_id, previous_customer_id: previousOwner.user_id, detached_at: null },
    });
    return { previousOwner, previousAgent, newOwner, newAgent, vehicle, reservation };
  }

  test("current owner sees history from a previous owner, with identity/invoice redacted", async () => {
    const { newAgent, newOwner, vehicle, reservation } = await claimedVehicleWithHistory();
    const pkg = await seedPackage();
    await createReservation({
      customerId: newOwner.user_id,
      vehicleId: vehicle.vehicle_id,
      packageId: pkg.package_id,
      estimatedDuration: pkg.estimated_duration,
      status: "Completed",
    });

    const res = await withPortal(newAgent, "customer")("get", `/api/bookings?vehicle_id=${vehicle.vehicle_id}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(2);

    const previousOwnerRow = res.body.bookings.find((b) => b.reservation_id === reservation.reservation_id);
    expect(previousOwnerRow.customer_name).toBeUndefined();
    expect(previousOwnerRow.customer_email).toBeUndefined();

    const ownRow = res.body.bookings.find((b) => b.reservation_id !== reservation.reservation_id);
    expect(ownRow.customer_name).toBeTruthy();
    expect(ownRow.customer_email).toBeTruthy();
  });

  test("403 when requesting vehicle_id for a vehicle you don't currently own", async () => {
    const { previousAgent, vehicle } = await claimedVehicleWithHistory();
    const res = await withPortal(previousAgent, "customer")("get", `/api/bookings?vehicle_id=${vehicle.vehicle_id}`);
    expect(res.status).toBe(403);
  });

  test("getBooking redacts identity and invoice for a previous owner's booking, viewed by the current owner", async () => {
    const { newAgent, reservation } = await claimedVehicleWithHistory();
    const res = await withPortal(newAgent, "customer")("get", `/api/bookings/${reservation.reservation_id}`);
    expect(res.status).toBe(200);
    expect(res.body.booking.customer_name).toBeUndefined();
    expect(res.body.booking.customer_email).toBeUndefined();
    expect(res.body.booking.invoice).toBeNull();
  });
});

describe("PATCH /api/bookings/:id/cancel", () => {
  test("customer can cancel their own future booking", async () => {
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const created = await withPortal(agent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(10),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const res = await withPortal(agent, "customer")("patch", `/api/bookings/${created.body.reservation_id}/cancel`);
    expect(res.status).toBe(200);
  });

  test("400 when cancelling within the 24-hour cutoff", async () => {
    const { createReservation } = require("./helpers/booking");
    const pkg = await seedPackage();
    const { customer, agent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const today = new Date().toISOString().split("T")[0];
    const reservation = await createReservation({
      customerId: customer.user_id,
      vehicleId: vehicle.vehicle_id,
      packageId: pkg.package_id,
      serviceDate: today,
      startTime: "08:00",
    });

    const res = await withPortal(agent, "customer")("patch", `/api/bookings/${reservation.reservation_id}/cancel`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/24 hours/i);
  });

  test("403 when cancelling someone else's booking", async () => {
    const pkg = await seedPackage();
    const { customer, agent: ownerAgent } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const created = await withPortal(ownerAgent, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(10),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const { agent: otherAgent } = await customerAgent({ email: "intruder2@test.local" });
    const res = await withPortal(otherAgent, "customer")("patch", `/api/bookings/${created.body.reservation_id}/cancel`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/bookings/:id/status", () => {
  test("manager can override status", async () => {
    const pkg = await seedPackage();
    const { customer, agent: customerA } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const created = await withPortal(customerA, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const { agent: managerA } = await staffAgent("Service Center Manager");
    const res = await withPortal(managerA, "staff")("patch", `/api/bookings/${created.body.reservation_id}/status`).send({ status: "Completed" });
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("Completed");
  });

  // Only a "Booked" appointment whose scheduled time is at least NO_SHOW_GRACE_MINUTES
  // in the past can be marked No-show — createReservation writes straight to the DB, which
  // is the only way to get a booking with a past start_time (the booking API itself refuses
  // to create one in the past).
  test("marks a booking No-show once its scheduled time is safely in the past", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const reservation = await createReservation({
      customerId: customer.user_id,
      vehicleId: vehicle.vehicle_id,
      packageId: pkg.package_id,
      serviceDate: pastTime.toISOString().split("T")[0],
      startTime: `${String(pastTime.getHours()).padStart(2, "0")}:${String(pastTime.getMinutes()).padStart(2, "0")}`,
    });

    const { agent: managerA } = await staffAgent("Service Center Manager");
    const res = await withPortal(managerA, "staff")("patch", `/api/bookings/${reservation.reservation_id}/status`).send({ status: "No-show" });
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("No-show");
  });

  test("400 when marking No-show before the grace period has elapsed", async () => {
    const pkg = await seedPackage();
    const { customer, agent: customerA } = await customerAgent();
    const vehicle = await createVehicle(customer.user_id);
    const created = await withPortal(customerA, "customer")("post", "/api/bookings").send({
      vehicle_id: vehicle.vehicle_id,
      package_id: pkg.package_id,
      service_date: nextWorkingDate(),
      start_time: "09:00",
      terms_accepted: true,
      terms_version: "1.0",
    });

    const { agent: managerA } = await staffAgent("Service Center Manager");
    const res = await withPortal(managerA, "staff")("patch", `/api/bookings/${created.body.reservation_id}/status`).send({ status: "No-show" });
    expect(res.status).toBe(400);
  });

  test("400 when marking No-show a booking that isn't currently Booked", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const pastTime = new Date(Date.now() - 60 * 60 * 1000);
    const reservation = await createReservation({
      customerId: customer.user_id,
      vehicleId: vehicle.vehicle_id,
      packageId: pkg.package_id,
      serviceDate: pastTime.toISOString().split("T")[0],
      startTime: `${String(pastTime.getHours()).padStart(2, "0")}:${String(pastTime.getMinutes()).padStart(2, "0")}`,
      status: "Cancelled",
    });

    const { agent: managerA } = await staffAgent("Service Center Manager");
    const res = await withPortal(managerA, "staff")("patch", `/api/bookings/${reservation.reservation_id}/status`).send({ status: "No-show" });
    expect(res.status).toBe(400);
  });

  test("403 when a non-manager tries to override status", async () => {
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent, "staff")("patch", "/api/bookings/1/status").send({ status: "Cancelled" });
    expect(res.status).toBe(403);
  });

  test("400 for an invalid status value", async () => {
    const { agent } = await staffAgent("Service Center Manager");
    const res = await withPortal(agent, "staff")("patch", "/api/bookings/1/status").send({ status: "Bogus" });
    expect(res.status).toBe(400);
  });
});
