const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Seed roles
  const roles = ["Service Center Manager", "Supervisor", "Cashier", "Service Staff", "Customer"];
  for (const role_name of roles) {
    await prisma.role.upsert({
      where: { role_name },
      update: {},
      create: { role_name },
    });
  }
  console.log("✅ Roles seeded");

  // Seed working config (single row)
  const configCount = await prisma.workingConfig.count();
  if (configCount === 0) {
    await prisma.workingConfig.create({ data: { daily_capacity: 10, working_days: "1,2,3,4,5" } });
  }
  console.log("✅ Working config seeded");

  // Seed time slots
  const slotCount = await prisma.timeSlot.count();
  if (slotCount === 0) {
    const times = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
    for (const t of times) {
      // Store as full ISO string — Prisma maps the time portion to the TIME column
      await prisma.timeSlot.create({ data: { slot_time: new Date(`1970-01-01T${t}:00.000Z`) } });
    }
  }
  console.log("✅ Time slots seeded");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
