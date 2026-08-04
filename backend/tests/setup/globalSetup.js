const { execSync } = require("child_process");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../../.env.test") });

// Runs once before the whole test run (see jest.config.js). Resets the
// isolated test database (see backend/.env.test — port 5433, never the dev
// DB on 5432) to a clean schema, then seeds the fixed reference data every
// suite relies on. Per-file isolation between test files is handled
// separately by tests/helpers/db.js's resetTransactionalTables().
module.exports = async () => {
  execSync("npx prisma db push --force-reset --accept-data-loss --skip-generate", {
    cwd: path.join(__dirname, "../.."),
    env: process.env,
    stdio: "inherit",
  });

  // reservations.status is a plain VarChar in schema.prisma (see scripts/add-status-constraint.js
  // for why) so the CHECK constraint isn't part of the Prisma-managed schema and needs applying
  // separately after every --force-reset, to keep the test DB's guarantees identical to production's.
  execSync("node scripts/add-status-constraint.js", {
    cwd: path.join(__dirname, "../.."),
    env: process.env,
    stdio: "inherit",
  });

  const { seedReferenceData } = require("./seedReferenceData");
  await seedReferenceData();

  const prisma = require("../../src/lib/prisma");
  await prisma.$disconnect();
};
