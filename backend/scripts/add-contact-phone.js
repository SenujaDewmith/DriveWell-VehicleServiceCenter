// Adds the manager-editable service center contact number to the working_config
// singleton row. Safe to re-run: ADD COLUMN is a no-op if it already exists, and the
// backfill only touches rows that are still NULL.
const prisma = require("../src/lib/prisma");

const DEFAULT_CONTACT_PHONE = "+94 77 830 8747";

const run = async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE working_config ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)`);
  await prisma.$executeRawUnsafe(
    `UPDATE working_config SET contact_phone = $1 WHERE contact_phone IS NULL`,
    DEFAULT_CONTACT_PHONE,
  );
  console.log("contact_phone column ready.");
  await prisma.$disconnect();
};

run().catch((err) => {
  console.error("Failed to add contact_phone column:", err);
  process.exit(1);
});
