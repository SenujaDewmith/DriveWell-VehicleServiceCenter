// Prisma returns DATE columns as full Date objects — format to "YYYY-MM-DD"
const fmtDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

// Prisma returns TIME columns as Date with epoch date — format to "HH:MM:SS"
const fmtTime = (d) => (d instanceof Date ? d.toISOString().slice(11, 19) : d);

// BigInt from $queryRaw COUNT() — convert to plain number
const fmtBigInt = (val) => (typeof val === "bigint" ? Number(val) : val);

// Recursively serialize an object — handles BigInt, Date from TIME/DATE columns
const serialize = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );

module.exports = { fmtDate, fmtTime, fmtBigInt, serialize };
