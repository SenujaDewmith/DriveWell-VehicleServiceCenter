// DB-level guardrail for Reservation.status, matching the redesigned 6-value lifecycle
// (Booked, Started, Completed, Collected, Cancelled, No-show). Deliberately a plain
// Postgres CHECK constraint rather than a Prisma-native enum: a native enum would force
// renaming "No-show" to a valid enum identifier (e.g. NoShow) everywhere it's read/written
// across both frontends and the backend, and a missed rename would silently break no-show
// handling. A CHECK constraint gives the same "reject invalid values" guarantee with zero
// change to the JS-facing value. Safe to re-run: drops and recreates the same constraint.
const prisma = require("../src/lib/prisma");

const run = async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE reservations DROP CONSTRAINT IF EXISTS chk_reservation_status`);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE reservations ADD CONSTRAINT chk_reservation_status
    CHECK (status IN ('Booked', 'Started', 'Completed', 'Collected', 'Cancelled', 'No-show'))
  `);
  console.log("chk_reservation_status constraint applied.");
  await prisma.$disconnect();
};

run().catch((err) => {
  console.error("Failed to apply status constraint:", err);
  process.exit(1);
});
