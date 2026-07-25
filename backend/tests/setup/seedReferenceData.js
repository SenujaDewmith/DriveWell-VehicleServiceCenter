const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const prisma = require("../../src/lib/prisma");

const MANAGER_EMAIL = "manager@test.local";
const MANAGER_PASSWORD = "Manager@123";

// Same CSV shape as prisma/seed.js — kept independent so test setup never
// depends on the dev seed script's side effects (default packages, etc).
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();
  const [headerLine, ...lines] = content.split(/\r?\n/);
  const headers = headerLine.split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

// Reference/lookup data every suite can assume exists: roles, vehicle
// catalog, business hours, and the one manager account tests log in as.
// Run once per full test run by jest's globalSetup, against a freshly
// pushed schema. tests/helpers/db.js's resetTransactionalTables() clears
// and re-creates only the manager account between test files — everything
// else here is left untouched all run.
async function seedReferenceData() {
  const seedDataDir = path.join(__dirname, "../../prisma/seed-data");

  const typeRows = parseCsv(path.join(seedDataDir, "vehicle_types.csv"));
  await prisma.vehicleType.createMany({
    data: typeRows.map((r) => ({ type_id: parseInt(r.id), name: r.name })),
    skipDuplicates: true,
  });

  const makeRows = parseCsv(path.join(seedDataDir, "makes.csv"));
  await prisma.vehicleMake.createMany({
    data: makeRows.map((r) => ({ make_id: parseInt(r.id), name: r.name })),
    skipDuplicates: true,
  });

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

  // Same fix as prisma/seed.js: explicit-id inserts above don't advance Postgres's
  // auto-increment sequences, so the first real create() (e.g. vehicle-catalog.test.js's
  // manager-creates-a-make tests) would collide with an existing seeded row.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_types', 'type_id'), COALESCE((SELECT MAX(type_id) FROM vehicle_types), 1))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_makes', 'make_id'), COALESCE((SELECT MAX(make_id) FROM vehicle_makes), 1))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_models', 'model_id'), COALESCE((SELECT MAX(model_id) FROM vehicle_models), 1))`;

  const roles = ["Service Center Manager", "Supervisor", "Cashier", "Service Staff", "Customer"];
  for (const role_name of roles) {
    await prisma.role.upsert({ where: { role_name }, update: {}, create: { role_name } });
  }

  await prisma.workingConfig.deleteMany();
  await prisma.workingConfig.create({
    data: {
      working_days: "1,2,3,4,5",
      day_start_time: new Date("1970-01-01T08:00:00.000Z"),
      day_end_time: new Date("1970-01-01T18:00:00.000Z"),
    },
  });

  await prisma.blockedTime.deleteMany();
  await prisma.blockedTime.create({
    data: {
      date: null,
      start_time: new Date("1970-01-01T12:00:00.000Z"),
      end_time: new Date("1970-01-01T13:00:00.000Z"),
      reason: "Lunch break",
    },
  });

  const managerRole = await prisma.role.findUnique({ where: { role_name: "Service Center Manager" } });
  const hash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: { password_hash: hash, role_id: managerRole.role_id, account_status: "active" },
    create: {
      email: MANAGER_EMAIL,
      password_hash: hash,
      role_id: managerRole.role_id,
      staff: { create: { full_name: "Test Manager" } },
    },
  });
}

module.exports = { seedReferenceData, MANAGER_EMAIL, MANAGER_PASSWORD };
