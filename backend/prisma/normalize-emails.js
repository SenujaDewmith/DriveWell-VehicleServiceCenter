// One-off backfill: lowercases every user's email so already-registered accounts become
// consistently findable by the now-normalized register/login/staff lookups (see
// src/schemas/auth.schema.js and src/controllers/users.controller.js). Safe to re-run —
// a no-op once every row is already lowercase.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { user_id: true, email: true } });

  const byLowerEmail = new Map();
  for (const u of users) {
    const key = u.email.toLowerCase();
    if (!byLowerEmail.has(key)) byLowerEmail.set(key, []);
    byLowerEmail.get(key).push(u);
  }

  const collisions = [...byLowerEmail.values()].filter((group) => group.length > 1);
  if (collisions.length > 0) {
    console.error(
      `❌ Found ${collisions.length} email(s) with case-only duplicate accounts — aborting without changing anything. Resolve these manually first:`
    );
    for (const group of collisions) {
      console.error(`  - ${group.map((u) => `user_id ${u.user_id}: "${u.email}"`).join(" vs ")}`);
    }
    process.exitCode = 1;
    return;
  }

  const toChange = users.filter((u) => u.email !== u.email.toLowerCase());
  if (toChange.length === 0) {
    console.log("✅ All emails already lowercase — nothing to do.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Pre-check found no collisions, but the @unique constraint still backstops any race.
    await tx.$executeRaw`UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email)`;
  });

  console.log(`✅ Lowercased ${toChange.length} email(s):`);
  for (const u of toChange) console.log(`  - user_id ${u.user_id}: "${u.email}" -> "${u.email.toLowerCase()}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
