const prisma = require("../../src/lib/prisma");

// From backend/prisma/seed-data — type_id 1 = Car, make_id 1 = Toyota, model_id 51 = Vitz
// (Vitz's own vehicle_type_id is 1, so this trio is internally consistent).
const CATALOG_VEHICLE = { vehicle_type_id: 1, make_id: 1, model_id: 51 };

let plateCounter = 0;
function nextPlate() {
  plateCounter += 1;
  return `TEST-${Date.now()}-${plateCounter}`;
}

// Working hours are Mon–Fri 08:00–18:00 (seedReferenceData). Picking a date
// comfortably in the future sidesteps same-day cutoff/lead-time rules in
// bookings.controller.js entirely — those are covered by their own tests.
function nextWorkingDate(minDaysAhead = 5) {
  const d = new Date();
  d.setDate(d.getDate() + minDaysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function timeToDate(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

async function createVehicle(customerId, overrides = {}) {
  return prisma.vehicle.create({
    data: {
      customer_id: customerId,
      vehicle_type_id: overrides.vehicle_type_id ?? CATALOG_VEHICLE.vehicle_type_id,
      make_id: overrides.make_id ?? CATALOG_VEHICLE.make_id,
      model_id: overrides.model_id ?? CATALOG_VEHICLE.model_id,
      year: overrides.year ?? 2020,
      plate_no: overrides.plate_no || nextPlate(),
    },
  });
}

// Creates a reservation directly (bypassing the business-rule gauntlet in
// POST /api/bookings, which bookings.test.js exercises for real) — for
// service-records/invoices/feedback suites that just need a booking to exist
// in a given status. estimated_duration must match the package passed in.
async function createReservation({ customerId, vehicleId, packageId, estimatedDuration = 60, serviceDate, startTime = "09:00", status = "Booked" }) {
  const date = serviceDate || nextWorkingDate();
  const startMin = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
  const endMin = startMin + estimatedDuration;
  const endStr = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  const reservation = await prisma.reservation.create({
    data: {
      customer_id: customerId,
      vehicle_id: vehicleId,
      package_id: packageId,
      start_time: timeToDate(startTime),
      end_time: timeToDate(endStr),
      service_date: new Date(date),
      status,
      terms_version: "1.0",
      terms_accepted_at: new Date(),
    },
  });

  const ref = `DW-${new Date(date).getFullYear()}-${String(reservation.reservation_id).padStart(5, "0")}`;
  return prisma.reservation.update({ where: { reservation_id: reservation.reservation_id }, data: { booking_ref: ref } });
}

module.exports = { CATALOG_VEHICLE, nextWorkingDate, timeToDate, createVehicle, createReservation };
