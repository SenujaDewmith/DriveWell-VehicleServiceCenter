const bcrypt = require("bcryptjs");
const prisma = require("../../src/lib/prisma");
const { MANAGER_EMAIL, MANAGER_PASSWORD } = require("../setup/seedReferenceData");

// Clears every table a test can mutate, in FK-safe (children-first) order,
// and re-creates the one seeded manager account. Reference data seeded once
// by globalSetup (roles, vehicle catalog, working_config, blocked_times) is
// left alone — it's immutable as far as tests are concerned.
// Packages and charge-catalog items ARE cleared here (not treated as fixed
// reference data) so packages.test.js / charge-catalog.test.js stay
// self-contained regardless of what other suites created; any suite that
// needs a package/charge item creates its own via seedPackage() /
// seedChargeCatalogItem() below.
async function resetTransactionalTables() {
  await prisma.feedback.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.serviceRecordItem.deleteMany();
  await prisma.serviceStaffAssignment.deleteMany();
  await prisma.serviceRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.vehicleTransferRequest.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany(); // cascades to customers/staff (schema onDelete: Cascade)
  await prisma.chargeCatalogItem.deleteMany();
  await prisma.servicePackage.deleteMany();

  const managerRole = await prisma.role.findUnique({ where: { role_name: "Service Center Manager" } });
  const hash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  await prisma.user.create({
    data: {
      email: MANAGER_EMAIL,
      password_hash: hash,
      role_id: managerRole.role_id,
      staff: { create: { full_name: "Test Manager" } },
    },
  });
}

async function seedPackage(overrides = {}) {
  return prisma.servicePackage.create({
    data: {
      name: overrides.name || "Standard Service",
      package_code: overrides.package_code,
      description: overrides.description || "Oil change and inspection",
      estimated_duration: overrides.estimated_duration ?? 60,
      price: overrides.price ?? 5000,
      max_capacity: overrides.max_capacity ?? 2,
      is_active: overrides.is_active ?? true,
      is_featured: overrides.is_featured ?? false,
    },
  });
}

async function seedChargeCatalogItem(overrides = {}) {
  return prisma.chargeCatalogItem.create({
    data: {
      name: overrides.name || "Brake Pad Replacement",
      description: overrides.description,
      default_price: overrides.default_price ?? 3500,
      category: overrides.category || "Parts",
      is_active: overrides.is_active ?? true,
    },
  });
}

module.exports = { resetTransactionalTables, seedPackage, seedChargeCatalogItem };
