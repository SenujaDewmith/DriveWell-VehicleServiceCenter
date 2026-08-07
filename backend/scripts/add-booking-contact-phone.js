// Adds the per-booking contact phone snapshot to reservations. Safe to re-run:
// ADD COLUMN IF NOT EXISTS is a no-op if it already exists.
const prisma = require("../src/lib/prisma");

const run = async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)`);
  console.log("reservations.contact_phone column ready.");
  await prisma.$disconnect();
};

run().catch((err) => {
  console.error("Failed to add contact_phone column:", err);
  process.exit(1);
});
