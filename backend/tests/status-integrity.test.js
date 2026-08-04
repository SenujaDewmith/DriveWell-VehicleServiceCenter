// Verifies the DB-level guardrails added for the service/payment status redesign actually
// reject bad data, not just the application-level checks in the controllers. These guarantee
// that even a bug or a direct DB write can't silently introduce a status value none of the
// app's `.includes()` checks recognize — which is exactly how the original "Ready for Pickup
// forgotten by the feedback gate" bug happened in the first place.
const prisma = require("../src/lib/prisma");
const { resetTransactionalTables, seedPackage } = require("./helpers/db");
const { createUser } = require("./helpers/auth");
const { createVehicle, createReservation } = require("./helpers/booking");

beforeEach(async () => {
  await resetTransactionalTables();
});

describe("reservations.status CHECK constraint", () => {
  test("rejects an invalid status value at the DB level", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Booked",
    });

    await expect(
      prisma.$executeRaw`UPDATE reservations SET status = 'Ready for Pickup' WHERE reservation_id = ${reservation.reservation_id}`,
    ).rejects.toThrow();

    await expect(
      prisma.$executeRaw`UPDATE reservations SET status = 'In Progress' WHERE reservation_id = ${reservation.reservation_id}`,
    ).rejects.toThrow();

    await expect(
      prisma.$executeRaw`UPDATE reservations SET status = 'Bogus' WHERE reservation_id = ${reservation.reservation_id}`,
    ).rejects.toThrow();

    // Confirms the constraint didn't also block legitimate values.
    await expect(
      prisma.$executeRaw`UPDATE reservations SET status = 'Started' WHERE reservation_id = ${reservation.reservation_id}`,
    ).resolves.toBeDefined();
  });

  test("accepts every value in the real lifecycle", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Booked",
    });

    for (const status of ["Started", "Completed", "Collected", "Cancelled", "No-show"]) {
      await expect(
        prisma.$executeRaw`UPDATE reservations SET status = ${status} WHERE reservation_id = ${reservation.reservation_id}`,
      ).resolves.toBeDefined();
    }
  });
});

describe("invoices.payment_status enum", () => {
  test("rejects an invalid payment_status value at the DB level", async () => {
    const pkg = await seedPackage();
    const customer = await createUser("Customer");
    const vehicle = await createVehicle(customer.user_id);
    const reservation = await createReservation({
      customerId: customer.user_id, vehicleId: vehicle.vehicle_id, packageId: pkg.package_id, status: "Completed",
    });
    const invoice = await prisma.invoice.create({
      data: { reservation_id: reservation.reservation_id, base_amount: 5000, total_amount: 5000 },
    });

    await expect(
      prisma.$executeRaw`UPDATE invoices SET payment_status = 'Refunded' WHERE invoice_id = ${invoice.invoice_id}`,
    ).rejects.toThrow();

    // Confirms the enum didn't also block the one legitimate transition.
    await expect(
      prisma.$executeRaw`UPDATE invoices SET payment_status = 'Paid' WHERE invoice_id = ${invoice.invoice_id}`,
    ).resolves.toBeDefined();
  });
});
