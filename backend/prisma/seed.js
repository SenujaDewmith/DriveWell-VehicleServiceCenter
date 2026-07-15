const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();
  const [headerLine, ...lines] = content.split(/\r?\n/);
  const headers = headerLine.split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    return row;
  });
}

async function main() {
  // Seed vehicle reference data (types → makes → models, in FK order)
  const seedDataDir = path.join(__dirname, "seed-data");

  const typeRows = parseCsv(path.join(seedDataDir, "vehicle_types.csv"));
  await prisma.vehicleType.createMany({
    data: typeRows.map((r) => ({ type_id: parseInt(r.id), name: r.name })),
    skipDuplicates: true,
  });
  console.log(`✅ Vehicle types seeded (${typeRows.length})`);

  const makeRows = parseCsv(path.join(seedDataDir, "makes.csv"));
  await prisma.vehicleMake.createMany({
    data: makeRows.map((r) => ({ make_id: parseInt(r.id), name: r.name })),
    skipDuplicates: true,
  });
  console.log(`✅ Vehicle makes seeded (${makeRows.length})`);

  const modelRows = parseCsv(path.join(seedDataDir, "models.csv"));
  await prisma.vehicleModel.createMany({
    data: modelRows.map((r) => ({
      model_id: parseInt(r.id),
      name: r.name,
      make_id: parseInt(r.make_id),
      start_year: r.start_year ? parseInt(r.start_year) : null,
      end_year: r.end_year ? parseInt(r.end_year) : null,
      vehicle_type_id: r.vehicle_type_id ? parseInt(r.vehicle_type_id) : null,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ Vehicle models seeded (${modelRows.length})`);

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

  // Seed working config (single row) — business hours + working days. Appointment windows
  // are auto-generated per package from these hours, not manually created time slots.
  const configCount = await prisma.workingConfig.count();
  if (configCount === 0) {
    await prisma.workingConfig.create({
      data: {
        working_days: "1,2,3,4,5",
        day_start_time: new Date("1970-01-01T08:00:00.000Z"),
        day_end_time: new Date("1970-01-01T18:00:00.000Z"),
      },
    });
  }
  console.log("✅ Working config seeded");

  // Seed a recurring lunch-break blocked time (applies to every working day)
  const blockedCount = await prisma.blockedTime.count();
  if (blockedCount === 0) {
    await prisma.blockedTime.create({
      data: {
        date: null,
        start_time: new Date("1970-01-01T12:00:00.000Z"),
        end_time: new Date("1970-01-01T13:00:00.000Z"),
        reason: "Lunch break",
      },
    });
  }
  console.log("✅ Blocked times seeded");

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
          max_capacity: 5,
        },
        {
          name: "Standard Service",
          description: "Oil change, filter replacement, fluid top-up, and basic inspection",
          estimated_duration: 120,
          price: 7500,
          max_capacity: 3,
        },
        {
          name: "Full Detail & Polish",
          description: "Complete interior and exterior detail with wax polish and engine clean",
          estimated_duration: 180,
          price: 14999,
          max_capacity: 2,
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
