const request = require("supertest");
const app = require("./helpers/app");
const { resetTransactionalTables, seedPackage, seedChargeCatalogItem } = require("./helpers/db");
const { createUser, loginAs } = require("./helpers/auth");
const { createVehicle, createReservation } = require("./helpers/booking");

beforeEach(async () => {
  await resetTransactionalTables();
});

async function staffAgent(role, overrides) {
  const staff = await createUser(role, overrides);
  const agent = request.agent(app);
  await loginAs(agent, staff, "staff");
  return { staff, agent };
}

const withPortal = (agent) => (method, path) => agent[method](path).set("X-Portal", "staff");

async function bookingFixture(status = "Booked") {
  const pkg = await seedPackage({ estimated_duration: 60 });
  const customer = await createUser("Customer");
  const vehicle = await createVehicle(customer.user_id);
  const reservation = await createReservation({
    customerId: customer.user_id,
    vehicleId: vehicle.vehicle_id,
    packageId: pkg.package_id,
    estimatedDuration: 60,
    status,
  });
  return { pkg, customer, vehicle, reservation };
}

describe("GET /api/service-records/staff-options", () => {
  test("supervisor sees active service staff", async () => {
    await createUser("Service Staff", { full_name: "Kasun" });
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent)("get", "/api/service-records/staff-options");
    expect(res.status).toBe(200);
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.staff[0].full_name).toBe("Kasun");
  });

  test("403 for a customer", async () => {
    const customer = await createUser("Customer");
    const agent = request.agent(app);
    await loginAs(agent, customer, "customer");
    const res = await agent.get("/api/service-records/staff-options").set("X-Portal", "customer");
    expect(res.status).toBe(403);
  });
});

describe("POST /api/service-records/:booking_id — start a service", () => {
  test("supervisor starts a service, creating a record and moving the booking to Started", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");

    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({ remarks: "Initial check" });
    expect(res.status).toBe(201);
    expect(res.body.record.reservation_id).toBe(reservation.reservation_id);

    const prisma = require("../src/lib/prisma");
    const updated = await prisma.reservation.findUnique({ where: { reservation_id: reservation.reservation_id } });
    expect(updated.status).toBe("Started");
  });

  test("400 when a record already exists for the booking", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    expect(res.status).toBe(400);
  });

  test("400 when the booking status can't be started (e.g. Cancelled)", async () => {
    const { reservation } = await bookingFixture("Cancelled");
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    expect(res.status).toBe(400);
  });

  test("403 for Service Staff (not Supervisor/Manager)", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Service Staff");
    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    expect(res.status).toBe(403);
  });

  test("401 when not authenticated", async () => {
    const { reservation } = await bookingFixture("Booked");
    const res = await request(app).post(`/api/service-records/${reservation.reservation_id}`).send({});
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/service-records/:booking_id — update remarks/odometer", () => {
  test("updates remarks and quality_checked", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({
      remarks: "All good", quality_checked: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.record.quality_checked).toBe(true);
  });

  test("400 when has_oil_change is true but odometer readings are missing", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({ has_oil_change: true });
    expect(res.status).toBe(400);
  });

  test("400 when next_service_odometer is not greater than current_odometer", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({
      has_oil_change: true, current_odometer: 50000, next_service_odometer: 40000,
    });
    expect(res.status).toBe(400);
  });

  test("accepts valid odometer readings when has_oil_change is true", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({
      has_oil_change: true, current_odometer: 50000, next_service_odometer: 55000, quality_checked: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.record.current_odometer).toBe(50000);
    expect(res.body.record.next_service_odometer).toBe(55000);
  });

  test("409 once the booking has reached Completed (record is finalized)", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({ quality_checked: true });
    await withPortal(agent)("patch", `/api/service-records/${reservation.reservation_id}/status`).send({ status: "Completed" });

    const res = await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({ remarks: "too late" });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/service-records/:booking_id/status", () => {
  test("400 when advancing to Completed without a quality check", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("patch", `/api/service-records/${reservation.reservation_id}/status`).send({ status: "Completed" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/quality check/i);
  });

  test("advances Started -> In Progress -> Completed once quality-checked", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const toInProgress = await withPortal(agent)("patch", `/api/service-records/${reservation.reservation_id}/status`).send({ status: "In Progress" });
    expect(toInProgress.status).toBe(200);

    await withPortal(agent)("put", `/api/service-records/${reservation.reservation_id}`).send({ quality_checked: true });
    const toCompleted = await withPortal(agent)("patch", `/api/service-records/${reservation.reservation_id}/status`).send({ status: "Completed" });
    expect(toCompleted.status).toBe(200);
    expect(toCompleted.body.status).toBe("Completed");
  });

  test("400 for an invalid status value", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent)("patch", `/api/service-records/${reservation.reservation_id}/status`).send({ status: "Bogus" });
    expect(res.status).toBe(400);
  });
});

describe("staff assignment endpoints", () => {
  test("assigns a staff contributor to a service", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    const svcStaff = await createUser("Service Staff", { full_name: "Nimal" });

    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({
      staff_id: svcStaff.user_id, work_note: "Vacuumed interior",
    });
    expect(res.status).toBe(201);
    expect(res.body.assignment.staff_name).toBe("Nimal");
  });

  test("400 when assigning the same staff member twice", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    const svcStaff = await createUser("Service Staff");

    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({ staff_id: svcStaff.user_id });
    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({ staff_id: svcStaff.user_id });
    expect(res.status).toBe(400);
  });

  test("400 once 3 staff members are already assigned", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    for (let i = 0; i < 3; i++) {
      const svcStaff = await createUser("Service Staff", { email: `staff${i}@test.local` });
      const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({ staff_id: svcStaff.user_id });
      expect(res.status).toBe(201);
    }
    const fourth = await createUser("Service Staff", { email: "staff4@test.local" });
    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({ staff_id: fourth.user_id });
    expect(res.status).toBe(400);
  });

  test("updates and then removes an assignment", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    const svcStaff = await createUser("Service Staff");
    const created = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/staff`).send({ staff_id: svcStaff.user_id });

    const updateRes = await withPortal(agent)("put", `/api/service-records/assignments/${created.body.assignment.assignment_id}`).send({ work_note: "Updated note" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.assignment.work_note).toBe("Updated note");

    const deleteRes = await withPortal(agent)("delete", `/api/service-records/assignments/${created.body.assignment.assignment_id}`);
    expect(deleteRes.status).toBe(200);
  });
});

describe("service record item endpoints", () => {
  test("adds an item from the charge catalog and a custom-description item", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    const catalogItem = await seedChargeCatalogItem({ name: "Brake Pad Replacement" });

    const fromCatalog = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/items`).send({ catalog_item_id: catalogItem.catalog_item_id });
    expect(fromCatalog.status).toBe(201);
    expect(fromCatalog.body.item.description).toBe("Brake Pad Replacement");

    const custom = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/items`).send({ description: "Windshield wiper worn out" });
    expect(custom.status).toBe(201);
    expect(custom.body.item.catalog_item_id).toBeNull();
  });

  test("400 when neither catalog_item_id nor description is given", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});

    const res = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/items`).send({});
    expect(res.status).toBe(400);
  });

  test("removes an item", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({});
    const item = await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}/items`).send({ description: "Custom item" });

    const res = await withPortal(agent)("delete", `/api/service-records/items/${item.body.item.item_id}`);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/service-records/:booking_id", () => {
  test("returns the record with its assignments", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    await withPortal(agent)("post", `/api/service-records/${reservation.reservation_id}`).send({ remarks: "hi" });

    const res = await withPortal(agent)("get", `/api/service-records/${reservation.reservation_id}`);
    expect(res.status).toBe(200);
    expect(res.body.record.remarks).toBe("hi");
    expect(res.body.assignments).toEqual([]);
  });

  test("404 when no record exists for the booking", async () => {
    const { reservation } = await bookingFixture("Booked");
    const { agent } = await staffAgent("Supervisor");
    const res = await withPortal(agent)("get", `/api/service-records/${reservation.reservation_id}`);
    expect(res.status).toBe(404);
  });
});
