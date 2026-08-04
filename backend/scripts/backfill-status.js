// One-off safety net for the service/payment status redesign — collapses the removed
// intermediate statuses into their nearest surviving state before the schema/enum change
// is applied, so `prisma db push` never has to reject a legacy row it can't represent.
// Safe to re-run: both UPDATEs are no-ops once no rows match.
const prisma = require("../src/lib/prisma");

const run = async () => {
  const before = await prisma.$queryRaw`SELECT status, COUNT(*)::int as count FROM reservations GROUP BY status`;
  console.log("Before:", before);

  const startedResult = await prisma.reservation.updateMany({
    where: { status: "In Progress" },
    data: { status: "Started" },
  });
  const completedResult = await prisma.reservation.updateMany({
    where: { status: "Ready for Pickup" },
    data: { status: "Completed" },
  });

  console.log(`Backfilled: ${startedResult.count} "In Progress" -> "Started", ${completedResult.count} "Ready for Pickup" -> "Completed"`);

  const after = await prisma.$queryRaw`SELECT status, COUNT(*)::int as count FROM reservations GROUP BY status`;
  console.log("After:", after);

  await prisma.$disconnect();
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
