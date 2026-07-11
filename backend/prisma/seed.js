const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

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

  // Seed default manager account (always syncs password so credentials are predictable)
  const managerRole = await prisma.role.findUnique({ where: { role_name: "Service Center Manager" } });
  const managerEmail = "manager@drivewell.lk";
  const managerPassword = "Manager@123";
  const hash = await bcrypt.hash(managerPassword, 10);
  const existingManager = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!existingManager) {
    await prisma.user.create({
      data: {
        email: managerEmail,
        password_hash: hash,
        role_id: managerRole.role_id,
        staff: { create: { full_name: "Service Manager" } },
      },
    });
  } else {
    await prisma.user.update({
      where: { email: managerEmail },
      data: { password_hash: hash, role_id: managerRole.role_id },
    });
  }
  console.log(`✅ Manager account ready — email: ${managerEmail} / password: ${managerPassword}`);

  // Seed service packages
  const packageCount = await prisma.servicePackage.count();
  if (packageCount === 0) {
    await prisma.servicePackage.createMany({
      data: [
        {
          name: "Basic Wash & Vacuum",
          description: "Exterior hand wash, interior vacuum, and window cleaning",
          estimated_duration: 60,
          price: 2500,
        },
        {
          name: "Standard Service",
          description: "Oil change, filter replacement, fluid top-up, and basic inspection",
          estimated_duration: 120,
          price: 7500,
        },
        {
          name: "Full Detail & Polish",
          description: "Complete interior and exterior detail with wax polish and engine clean",
          estimated_duration: 180,
          price: 14999,
        },
      ],
    });
    console.log("✅ Service packages seeded");
  } else {
    console.log("✅ Service packages already exist");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
