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
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function toTimeDate(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function addMinutesToHHMM(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Mirrors the real booking flow in bookings.controller.js: create the reservation
// first, then stamp its booking_ref from the id it was just given.
async function seedReservation({
  customerId,
  vehicleId,
  packageId,
  duration,
  serviceDate,
  startTime,
  status,
  contactPhone,
}) {
  const endTime = addMinutesToHHMM(startTime, duration);
  const reservation = await prisma.reservation.create({
    data: {
      customer_id: customerId,
      vehicle_id: vehicleId,
      package_id: packageId,
      service_date: new Date(serviceDate),
      start_time: toTimeDate(startTime),
      end_time: toTimeDate(endTime),
      status,
      contact_phone: contactPhone,
      terms_version: "1.0",
      terms_accepted_at: new Date(serviceDate),
    },
  });
  const ref = `DW-${new Date(serviceDate).getFullYear()}-${String(reservation.reservation_id).padStart(5, "0")}`;
  return prisma.reservation.update({
    where: { reservation_id: reservation.reservation_id },
    data: { booking_ref: ref },
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

  // The rows above were inserted with explicit ids from the CSVs, which never advances
  // Postgres's own auto-increment sequence for these tables — the next INSERT without an
  // explicit id (e.g. a manager adding a new make/model/type through the app) would collide
  // with an existing row and fail. Bring each sequence up to date with the actual max id.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_types', 'type_id'), COALESCE((SELECT MAX(type_id) FROM vehicle_types), 1))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_makes', 'make_id'), COALESCE((SELECT MAX(make_id) FROM vehicle_makes), 1))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('vehicle_models', 'model_id'), COALESCE((SELECT MAX(model_id) FROM vehicle_models), 1))`;
  console.log("✅ Vehicle catalog sequences synced");

  // Seed roles
  const roles = [
    "Service Center Manager",
    "Supervisor",
    "Cashier",
    "Service Staff",
    "Customer",
  ];
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
        working_days: "1,2,3,4,5,6,7",
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
  const managerRole = await prisma.role.findUnique({
    where: { role_name: "Service Center Manager" },
  });
  const managerEmail = "manager@drivewell.lk";
  const managerPassword = "Manager@123";
  const hash = await bcrypt.hash(managerPassword, 10);
  const existingManager = await prisma.user.findUnique({
    where: { email: managerEmail },
  });
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
  console.log(
    `✅ Manager account ready — email: ${managerEmail} / password: ${managerPassword}`,
  );

  // Seed the 6 initial service packages — images point at real photos already
  // present under uploads/packages (shared across every DB since they live on disk,
  // not in a table), so a freshly seeded DB renders package cards immediately.
  const packageCount = await prisma.servicePackage.count();
  if (packageCount === 0) {
    await prisma.servicePackage.createMany({
      data: [
        {
          name: "Express Wash & Vacuum",
          package_code: "DWP-001",
          description:
            "Exterior wash, tire dressing, interior vacuum, and window cleaning (interior & exterior) — a fast, complete wash",
          estimated_duration: 60,
          price: 5000,
          max_capacity: 4,
          image_url: "/uploads/packages/pkg-1784540486222-1154b2312c78.jpg",
          is_featured: true,
        },
        {
          name: "Full Service Wash",
          package_code: "DWP-002",
          description:
            "Exterior wash, tire dressing, interior vacuum, and window cleaning (interior & exterior) — a fast, complete wash, plus interior wipe-down, engine bay rinse, undercarriage wash, and air freshener",
          estimated_duration: 180,
          price: 15500,
          max_capacity: 3,
          image_url: "/uploads/packages/pkg-1784540929427-828b1ae518cb.jpg",
        },
        {
          name: "Premium Detailing",
          package_code: "DWP-003",
          description:
            "Clay bar treatment, machine polish, wax coat, leather conditioning, headlight restoration, engine bay clean, and tyre dressing",
          estimated_duration: 240,
          price: 20000,
          max_capacity: 2,
          image_url: "/uploads/packages/pkg-1784541021395-934f85648ccb.jfif",
        },
        {
          name: "Ceramic Coating",
          package_code: "DWP-004",
          description:
            "Paint correction, multi-layer ceramic coating, gloss & hydrophobic finish, long-term paint protection",
          estimated_duration: 240,
          price: 35000,
          max_capacity: 2,
          image_url: "/uploads/packages/pkg-1784541577484-5d8067f2d2f2.jpg",
          is_featured: true,
        },
        {
          name: "Specialty Care Package",
          package_code: "DWP-005",
          description:
            "Seat & carpet shampoo, dashboard/console detailing, odor treatment, engine bay degreasing, undercarriage rust-proofing rinse",
          estimated_duration: 240,
          price: 13000,
          max_capacity: 3,
          image_url: "/uploads/packages/pkg-1784541244992-e466d9bb4f7a.jfif",
        },
        {
          name: "EV Care Package",
          package_code: "DWP-006",
          description:
            "Battery-safe exterior wash with charging-port and battery-compartment-safe water handling, interior vacuum & sanitization, tyre dressing, and a routine EV health check (12V battery, coolant, brake wear) — tailored for electric vehicles",
          estimated_duration: 90,
          price: 8000,
          max_capacity: 3,
          image_url: "/uploads/packages/pkg-1784541656699-1994319395b3.jfif",
          is_featured: true,
        },
      ],
    });
    console.log("✅ Service packages seeded (6)");
  } else {
    console.log("✅ Service packages already exist");
  }

  // Seed company staff roster — active immediately with a known password (no invite-email
  // flow) so a freshly seeded DB is demo-ready without a MailHog dependency.
  const staffPassword = "Staff@123";
  const staffHash = await bcrypt.hash(staffPassword, 10);
  const supervisorRole = await prisma.role.findUnique({
    where: { role_name: "Supervisor" },
  });
  const cashierRole = await prisma.role.findUnique({
    where: { role_name: "Cashier" },
  });
  const serviceStaffRole = await prisma.role.findUnique({
    where: { role_name: "Service Staff" },
  });

  const staffRoster = [
    {
      full_name: "Suranga Athukorala",
      email: "suranga.athukorala@drivewell.lk",
      phone_no: "+94771001001",
      role_id: supervisorRole.role_id,
    },
    {
      full_name: "Menaka Wijetunge",
      email: "menaka.wijetunge@drivewell.lk",
      phone_no: "+94771001002",
      role_id: supervisorRole.role_id,
    },
    {
      full_name: "Chamika Ranasinghe",
      email: "chamika.ranasinghe@drivewell.lk",
      phone_no: "+94771001003",
      role_id: cashierRole.role_id,
    },
    {
      full_name: "Isuru Bandaranaike",
      email: "isuru.bandaranaike@drivewell.lk",
      phone_no: "+94771001011",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Dinesh Rajapaksha",
      email: "dinesh.rajapaksha@drivewell.lk",
      phone_no: "+94771001012",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Shalini Herath",
      email: "shalini.herath@drivewell.lk",
      phone_no: "+94771001013",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Roshan Peiris",
      email: "roshan.peiris@drivewell.lk",
      phone_no: "+94771001014",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Nadeesha Gamage",
      email: "nadeesha.gamage@drivewell.lk",
      phone_no: "+94771001015",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Thilina Wijesinghe",
      email: "thilina.wijesinghe@drivewell.lk",
      phone_no: "+94771001016",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Ishara Ekanayake",
      email: "ishara.ekanayake@drivewell.lk",
      phone_no: "+94771001017",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Sachini Liyanage",
      email: "sachini.liyanage@drivewell.lk",
      phone_no: "+94771001018",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Lahiru Amarasinghe",
      email: "lahiru.amarasinghe@drivewell.lk",
      phone_no: "+94771001019",
      role_id: serviceStaffRole.role_id,
    },
    {
      full_name: "Manoj Kodithuwakku",
      email: "manoj.kodithuwakku@drivewell.lk",
      phone_no: "+94771001020",
      role_id: serviceStaffRole.role_id,
    },
  ];

  for (const person of staffRoster) {
    const existing = await prisma.user.findUnique({
      where: { email: person.email },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: person.email,
          password_hash: staffHash,
          role_id: person.role_id,
          staff: {
            create: { full_name: person.full_name, phone_no: person.phone_no },
          },
        },
      });
    } else {
      await prisma.user.update({
        where: { email: person.email },
        data: {
          password_hash: staffHash,
          role_id: person.role_id,
          account_status: "active",
        },
      });
    }
  }
  console.log(
    `✅ Staff roster seeded (${staffRoster.length}) — password: ${staffPassword}`,
  );

  // Seed 10 initial customers, each with one catalog vehicle, so Vehicles/Bookings
  // screens aren't empty on a fresh DB. Live demo actions (transfers, bookings, second
  // vehicles, etc.) still happen on top of this baseline per the viva demo plan.
  const customerPassword = "Customer@123";
  const customerHash = await bcrypt.hash(customerPassword, 10);
  const customerRole = await prisma.role.findUnique({
    where: { role_name: "Customer" },
  });

  const customerRoster = [
    {
      full_name: "Kasun Perera",
      email: "kasun.perera@gmail.com",
      vehicle: {
        make_id: 1,
        model_id: 51,
        vehicle_type_id: 1,
        year: 2019,
        plate_no: "CAB-4521",
      },
    },
    {
      full_name: "Nimali Fernando",
      email: "nimali.fernando@gmail.com",
      vehicle: {
        make_id: 2,
        model_id: 104,
        vehicle_type_id: 1,
        year: 2020,
        plate_no: "CAJ-2210",
      },
    },
    {
      full_name: "Chathura Jayasinghe",
      email: "chathura.jayasinghe@gmail.com",
      vehicle: {
        make_id: 3,
        model_id: 126,
        vehicle_type_id: 1,
        year: 2018,
        plate_no: "CAP-6634",
      },
    },
    {
      full_name: "Dilani Wickramasinghe",
      email: "dilani.wickramasinghe@gmail.com",
      vehicle: {
        make_id: 1,
        model_id: 56,
        vehicle_type_id: 1,
        year: 2021,
        plate_no: "CAT-8890",
      },
    },
    {
      full_name: "Sanduni Rathnayake",
      email: "sanduni.rathnayake@gmail.com",
      vehicle: {
        make_id: 3,
        model_id: 125,
        vehicle_type_id: 2,
        year: 2019,
        plate_no: "CAR-1123",
      },
    },
    {
      full_name: "Buddhika Gunawardena",
      email: "buddhika.gunawardena@gmail.com",
      vehicle: {
        make_id: 4,
        model_id: 143,
        vehicle_type_id: 2,
        year: 2020,
        plate_no: "CAW-4456",
      },
    },
    {
      full_name: "Tharushi de Silva",
      email: "tharushi.desilva@gmail.com",
      vehicle: {
        make_id: 1,
        model_id: 53,
        vehicle_type_id: 1,
        year: 2019,
        plate_no: "CAG-7789",
      },
    },
    {
      full_name: "Nuwan Dissanayake",
      email: "nuwan.dissanayake@gmail.com",
      vehicle: {
        make_id: 1,
        model_id: 60,
        vehicle_type_id: 1,
        year: 2018,
        plate_no: "CAK-3345",
      },
    },
    {
      full_name: "Amaya Senanayake",
      email: "amaya.senanayake@gmail.com",
      vehicle: {
        make_id: 2,
        model_id: 101,
        vehicle_type_id: 1,
        year: 2021,
        plate_no: "CAF-5567",
      },
    },
    {
      full_name: "Kavindu Weerasinghe",
      email: "kavindu.weerasinghe@gmail.com",
      vehicle: {
        make_id: 2,
        model_id: 102,
        vehicle_type_id: 1,
        year: 2017,
        plate_no: "CAM-9912",
      },
    },
  ];

  for (const person of customerRoster) {
    let user = await prisma.user.findUnique({ where: { email: person.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: person.email,
          password_hash: customerHash,
          role_id: customerRole.role_id,
          customer: { create: { full_name: person.full_name } },
        },
      });
    } else {
      await prisma.user.update({
        where: { email: person.email },
        data: {
          password_hash: customerHash,
          role_id: customerRole.role_id,
          account_status: "active",
        },
      });
    }

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { plate_no: person.vehicle.plate_no },
    });
    if (!existingVehicle) {
      await prisma.vehicle.create({
        data: {
          customer_id: user.user_id,
          make_id: person.vehicle.make_id,
          model_id: person.vehicle.model_id,
          vehicle_type_id: person.vehicle.vehicle_type_id,
          year: person.vehicle.year,
          plate_no: person.vehicle.plate_no,
        },
      });
    }
  }
  console.log(
    `✅ Customers + vehicles seeded (${customerRoster.length}) — password: ${customerPassword}`,
  );

  // Seed the manager's reusable "extra charge" price list — used both directly by
  // service-record items below and by the cashier when itemizing an invoice.
  const chargeCatalogCount = await prisma.chargeCatalogItem.count();
  if (chargeCatalogCount === 0) {
    await prisma.chargeCatalogItem.createMany({
      data: [
        {
          name: "Brake Pad Replacement",
          description: "Front or rear brake pad replacement",
          default_price: 4500,
          category: "Parts",
        },
        {
          name: "Wiper Blade Replacement",
          description: "Pair of wiper blades",
          default_price: 1200,
          category: "Parts",
        },
        {
          name: "Engine Oil Top-up",
          description: "Top up engine oil between full changes",
          default_price: 2000,
          category: "Fluids",
        },
        {
          name: "Air Filter Replacement",
          description: "Engine air filter replacement",
          default_price: 1800,
          category: "Parts",
        },
        {
          name: "Battery Terminal Cleaning",
          description: "Clean and protect battery terminals",
          default_price: 800,
          category: "Service",
        },
      ],
    });
    console.log("✅ Charge catalog seeded (5)");
  } else {
    console.log("✅ Charge catalog already exists");
  }
  const chargeCatalogItems = await prisma.chargeCatalogItem.findMany();
  const chargeCatalogByName = Object.fromEntries(
    chargeCatalogItems.map((c) => [c.name, c]),
  );

  // Seed two one-off public holidays (in addition to the recurring lunch-break block
  // seeded above) — distinct from a lunch closure: a full-day block on a specific date.
  const holidayCount = await prisma.blockedTime.count({
    where: { NOT: { date: null } },
  });
  if (holidayCount === 0) {
    await prisma.blockedTime.createMany({
      data: [
        {
          date: new Date("2026-04-13"),
          start_time: new Date("1970-01-01T00:00:00.000Z"),
          end_time: new Date("1970-01-01T23:59:00.000Z"),
          reason: "Public Holiday — Sinhala & Tamil New Year",
        },
        {
          date: new Date("2026-12-25"),
          start_time: new Date("1970-01-01T00:00:00.000Z"),
          end_time: new Date("1970-01-01T23:59:00.000Z"),
          reason: "Public Holiday — Christmas",
        },
      ],
    });
    console.log("✅ Holidays seeded (2)");
  } else {
    console.log("✅ Holidays already exist");
  }

  // Everything below (bookings across every status, service history, invoices,
  // feedback, transfer requests/history, a detached vehicle, a pending-catalog-review
  // vehicle) is a rich demo scenario weighted toward the accounts used for the viva
  // walkthrough: manager, Suranga (Supervisor), Chamika (Cashier), Isuru (Service
  // Staff), and customers Kasun/Nimali/Chathura — with light coverage everywhere else
  // so no account looks empty. Gated on reservation count so it only ever runs once.
  const reservationCount = await prisma.reservation.count();
  if (reservationCount === 0) {
    const staffUserByEmail = Object.fromEntries(
      (
        await prisma.user.findMany({
          where: { email: { in: staffRoster.map((s) => s.email) } },
          select: { user_id: true, email: true },
        })
      ).map((u) => [u.email, u.user_id]),
    );
    const staffNameByEmail = Object.fromEntries(
      staffRoster.map((s) => [s.email, s.full_name]),
    );

    const customerUserByEmail = Object.fromEntries(
      (
        await prisma.user.findMany({
          where: { email: { in: customerRoster.map((c) => c.email) } },
          select: { user_id: true, email: true },
        })
      ).map((u) => [u.email, u.user_id]),
    );

    const vehicleIdByPlate = Object.fromEntries(
      (
        await prisma.vehicle.findMany({
          where: {
            plate_no: { in: customerRoster.map((c) => c.vehicle.plate_no) },
          },
          select: { vehicle_id: true, plate_no: true },
        })
      ).map((v) => [v.plate_no, v.vehicle_id]),
    );

    const packagesList = await prisma.servicePackage.findMany();
    const packageByName = Object.fromEntries(
      packagesList.map((p) => [p.name, p]),
    );

    const CASHIER_EMAIL = "chamika.ranasinghe@drivewell.lk";

    // Kasun's second vehicle — a make/model not in the catalog, so it sits "pending
    // catalog review" until the manager resolves it (a scenario worth having live).
    await prisma.vehicle.create({
      data: {
        customer_id: customerUserByEmail["kasun.perera@gmail.com"],
        vehicle_type_id: 1, // Car
        custom_make: "Morris",
        custom_model: "Minor",
        year: 1975,
        plate_no: "CAA-0099",
      },
    });

    // Every booking scenario, in one place. `supervisor` present = a service_record
    // gets created (Started/Completed/Collected); omit it for Booked/Cancelled/No-show,
    // which are just a reservation row on its own.
    const bookingScenarios = [
      // --- Kasun Perera (hero) — full lifecycle on one vehicle: every status, one vehicle ---
      {
        customer: "kasun.perera@gmail.com",
        vehicle: "CAB-4521",
        package: "Premium Detailing",
        date: "2026-07-10",
        time: "09:00",
        status: "Collected",
        phone: "+94770100001",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "isuru.bandaranaike@drivewell.lk",
          "dinesh.rajapaksha@drivewell.lk",
          "shalini.herath@drivewell.lk",
        ],
        remarks:
          "Full premium detail completed — clay bar, machine polish, and wax coat all done. Customer very satisfied.",
        hasOilChange: true,
        currentOdometer: 45210,
        nextServiceOdometer: 50210,
        qualityChecked: true,
        invoice: { paymentStatus: "Paid", method: "Card", discount: 500 },
        feedback: {
          rating: 5,
          comment: "Amazing detail work, my car looks brand new!",
          featured: true,
        },
      },
      {
        customer: "kasun.perera@gmail.com",
        vehicle: "CAB-4521",
        package: "Express Wash & Vacuum",
        date: "2026-07-15",
        time: "10:00",
        status: "Collected",
        phone: "+94770100001",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "isuru.bandaranaike@drivewell.lk",
          "roshan.peiris@drivewell.lk",
        ],
        remarks: "Quick wash and vacuum, no issues.",
        qualityChecked: true,
        invoice: { paymentStatus: "Paid", method: "Cash" },
        // Deliberately no feedback — shows a review is optional, not every closed job gets one.
      },
      {
        customer: "kasun.perera@gmail.com",
        vehicle: "CAB-4521",
        package: "Full Service Wash",
        date: "2026-07-20",
        time: "09:00",
        status: "Cancelled",
        phone: "+94770100001",
      },
      {
        customer: "kasun.perera@gmail.com",
        vehicle: "CAB-4521",
        package: "Specialty Care Package",
        date: "2026-07-22",
        time: "09:00",
        status: "No-show",
        phone: "+94770100001",
      },
      {
        customer: "kasun.perera@gmail.com",
        vehicle: "CAB-4521",
        package: "Ceramic Coating",
        date: "2026-08-15",
        time: "09:00",
        status: "Booked",
        phone: "+94770100001",
      },

      // --- Nimali Fernando (hero) — closed-out service history; her vehicle is deliberately
      // left with no unresolved booking so the live transfer-approval demo below isn't blocked ---
      {
        customer: "nimali.fernando@gmail.com",
        vehicle: "CAJ-2210",
        package: "Ceramic Coating",
        date: "2026-07-18",
        time: "09:00",
        status: "Collected",
        phone: "+94770100002",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "isuru.bandaranaike@drivewell.lk",
          "nadeesha.gamage@drivewell.lk",
        ],
        remarks: "Ceramic coat applied, excellent gloss finish.",
        qualityChecked: true,
        invoice: { paymentStatus: "Paid", method: "Card" },
        feedback: {
          rating: 5,
          comment: "Incredible shine, worth every rupee!",
          featured: true,
        },
      },

      // --- Chathura Jayasinghe (hero) — service history plus an upcoming booking ---
      {
        customer: "chathura.jayasinghe@gmail.com",
        vehicle: "CAP-6634",
        package: "Specialty Care Package",
        date: "2026-07-25",
        time: "09:00",
        status: "Collected",
        phone: "+94770100003",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "thilina.wijesinghe@drivewell.lk",
          "ishara.ekanayake@drivewell.lk",
        ],
        remarks: "Interior deep clean and odor treatment done.",
        qualityChecked: true,
        invoice: { paymentStatus: "Paid", method: "Cash" },
        feedback: {
          rating: 4,
          comment: "Car smells fresh again, good job.",
          featured: true,
        },
      },
      {
        customer: "chathura.jayasinghe@gmail.com",
        vehicle: "CAP-6634",
        package: "EV Care Package",
        date: "2026-08-14",
        time: "10:00",
        status: "Booked",
        phone: "+94770100003",
      },

      // --- Sanduni Rathnayake (other) — service history on the Vezel BEFORE it transfers
      // to Buddhika below; still shows for him afterward since vehicle history follows the asset ---
      {
        customer: "sanduni.rathnayake@gmail.com",
        vehicle: "CAR-1123",
        package: "Ceramic Coating",
        date: "2026-07-12",
        time: "09:00",
        status: "Collected",
        phone: "+94770100005",
        supervisor: "menaka.wijetunge@drivewell.lk",
        staff: [
          "sachini.liyanage@drivewell.lk",
          "lahiru.amarasinghe@drivewell.lk",
        ],
        remarks:
          "Ceramic coating applied evenly, customer walked through aftercare.",
        qualityChecked: true,
        invoice: { paymentStatus: "Paid", method: "Card" },
        feedback: {
          rating: 5,
          comment: "Excellent service, highly recommend.",
        },
      },

      // --- Buddhika Gunawardena (other) — books on his own vehicle, and on the Vezel he
      // acquires via the approved transfer below ---
      {
        customer: "buddhika.gunawardena@gmail.com",
        vehicle: "CAR-1123",
        package: "Express Wash & Vacuum",
        date: "2026-08-20",
        time: "09:00",
        status: "Booked",
        phone: "+94770100006",
      },
      {
        // Same-day as the viva itself — deliberately <24h out, for the live "cancel blocked" demo.
        customer: "buddhika.gunawardena@gmail.com",
        vehicle: "CAW-4456",
        package: "Express Wash & Vacuum",
        date: "2026-08-09",
        time: "09:00",
        status: "Booked",
        phone: "+94770100006",
      },

      // --- Tharushi de Silva (other) — Completed, no invoice yet: cashier generates one live ---
      {
        customer: "tharushi.desilva@gmail.com",
        vehicle: "CAG-7789",
        package: "Premium Detailing",
        date: "2026-08-05",
        time: "09:00",
        status: "Completed",
        phone: "+94770100007",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "isuru.bandaranaike@drivewell.lk",
          "manoj.kodithuwakku@drivewell.lk",
        ],
        remarks: "Full detail complete, awaiting invoice.",
        qualityChecked: true,
        extraItem: {
          catalog: "Brake Pad Replacement",
          description: "Front brake pads replaced",
          quantity: 1,
        },
        // No invoice on purpose.
      },

      // --- Nuwan Dissanayake (other) — Completed WITH an Unpaid invoice: cashier marks it Paid live ---
      {
        customer: "nuwan.dissanayake@gmail.com",
        vehicle: "CAK-3345",
        package: "Full Service Wash",
        date: "2026-08-06",
        time: "09:00",
        status: "Completed",
        phone: "+94770100008",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "dinesh.rajapaksha@drivewell.lk",
          "shalini.herath@drivewell.lk",
        ],
        remarks: "Full wash complete, invoice pending payment.",
        hasOilChange: true,
        currentOdometer: 88120,
        nextServiceOdometer: 93120,
        qualityChecked: true,
        extraItem: {
          catalog: "Wiper Blade Replacement",
          description: "Replaced worn wiper blades",
          quantity: 1,
        },
        invoice: { paymentStatus: "Unpaid" },
      },

      // --- Dilani Wickramasinghe (other) — Started today: an in-progress job to continue live ---
      {
        customer: "dilani.wickramasinghe@gmail.com",
        vehicle: "CAT-8890",
        package: "Full Service Wash",
        date: "2026-08-08",
        time: "09:00",
        status: "Started",
        phone: "+94770100004",
        supervisor: "suranga.athukorala@drivewell.lk",
        staff: [
          "isuru.bandaranaike@drivewell.lk",
          "roshan.peiris@drivewell.lk",
        ],
        remarks: "Service in progress — engine bay rinse underway.",
        qualityChecked: false,
      },

      // --- Amaya Senanayake (other) — a successful customer-side cancellation ---
      {
        customer: "amaya.senanayake@gmail.com",
        vehicle: "CAF-5567",
        package: "Full Service Wash",
        date: "2026-07-28",
        time: "09:00",
        status: "Cancelled",
        phone: "+94770100009",
      },
    ];

    for (const b of bookingScenarios) {
      const pkg = packageByName[b.package];
      const reservation = await seedReservation({
        customerId: customerUserByEmail[b.customer],
        vehicleId: vehicleIdByPlate[b.vehicle],
        packageId: pkg.package_id,
        duration: pkg.estimated_duration,
        serviceDate: b.date,
        startTime: b.time,
        status: b.status,
        contactPhone: b.phone,
      });

      if (!b.supervisor) continue; // Booked/Cancelled/No-show — nothing further to create

      const endTime = addMinutesToHHMM(b.time, pkg.estimated_duration);
      const record = await prisma.serviceRecord.create({
        data: {
          reservation_id: reservation.reservation_id,
          supervisor_id: staffUserByEmail[b.supervisor],
          supervisor_name: staffNameByEmail[b.supervisor],
          remarks: b.remarks,
          quality_checked: b.qualityChecked ?? false,
          has_oil_change: b.hasOilChange ?? false,
          current_odometer: b.currentOdometer ?? null,
          next_service_odometer: b.nextServiceOdometer ?? null,
          started_at: new Date(`${b.date}T${b.time}:00.000Z`),
          completed_at:
            b.status === "Started"
              ? null
              : new Date(`${b.date}T${endTime}:00.000Z`),
        },
      });

      for (const staffEmail of b.staff) {
        await prisma.serviceStaffAssignment.create({
          data: {
            record_id: record.record_id,
            staff_id: staffUserByEmail[staffEmail],
            staff_name: staffNameByEmail[staffEmail],
          },
        });
      }

      if (b.extraItem) {
        const catalogItem = chargeCatalogByName[b.extraItem.catalog];
        await prisma.serviceRecordItem.create({
          data: {
            record_id: record.record_id,
            catalog_item_id: catalogItem.catalog_item_id,
            description: b.extraItem.description,
            quantity: b.extraItem.quantity,
          },
        });
      }

      if (b.invoice) {
        const baseAmount = Number(pkg.price);
        const items = [];
        let additionalCharges = 0;
        if (b.extraItem) {
          const catalogItem = chargeCatalogByName[b.extraItem.catalog];
          const unitPrice = Number(catalogItem.default_price);
          const lineTotal = unitPrice * b.extraItem.quantity;
          additionalCharges += lineTotal;
          items.push({
            catalog_item_id: catalogItem.catalog_item_id,
            description: b.extraItem.description,
            unit_price: unitPrice,
            quantity: b.extraItem.quantity,
            line_total: lineTotal,
          });
        }
        const discount = b.invoice.discount ?? 0;

        await prisma.invoice.create({
          data: {
            reservation_id: reservation.reservation_id,
            cashier_id: staffUserByEmail[CASHIER_EMAIL],
            cashier_name: staffNameByEmail[CASHIER_EMAIL],
            base_amount: baseAmount,
            additional_charges: additionalCharges,
            discount,
            total_amount: baseAmount + additionalCharges - discount,
            payment_status: b.invoice.paymentStatus,
            payment_method: b.invoice.method ?? null,
            items: { create: items },
          },
        });
      }

      if (b.feedback) {
        await prisma.feedback.create({
          data: {
            reservation_id: reservation.reservation_id,
            customer_id: customerUserByEmail[b.customer],
            rating: b.feedback.rating,
            comment: b.feedback.comment,
            is_featured: b.feedback.featured ?? false,
          },
        });
      }
    }
    console.log(
      `✅ Bookings + service history seeded (${bookingScenarios.length})`,
    );

    // Vehicle transfer requests — one still Pending (for a live approve/reject demo),
    // one already Approved, one already Rejected (transfer history).
    const managerUser = await prisma.user.findUnique({
      where: { email: "manager@drivewell.lk" },
    });

    await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicleIdByPlate["CAJ-2210"],
        requester_id: customerUserByEmail["chathura.jayasinghe@gmail.com"],
        current_owner_id: customerUserByEmail["nimali.fernando@gmail.com"],
        contact_phone: "+94770100003",
        status: "Pending",
        source: "Customer",
        // Reused from real transfer-request submissions already on disk under uploads/transfer-documents.
        registration_book_photo_path:
          "logbook_photo-156-1784992005837-fd3314764df6.jpg",
        nic_photo_path: "nic_photo-156-1784992005837-05f9432b52d0.jpg",
      },
    });

    await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicleIdByPlate["CAR-1123"],
        requester_id: customerUserByEmail["buddhika.gunawardena@gmail.com"],
        current_owner_id: customerUserByEmail["sanduni.rathnayake@gmail.com"],
        contact_phone: "+94770100006",
        status: "Approved",
        source: "Customer",
        reviewer_id: managerUser.user_id,
        reviewed_at: new Date("2026-07-30"),
      },
    });
    // The approval above is already reflected as fact — actually move ownership,
    // same as performOwnershipTransfer does in vehicle-transfers.controller.js.
    await prisma.vehicle.update({
      where: { plate_no: "CAR-1123" },
      data: {
        customer_id: customerUserByEmail["buddhika.gunawardena@gmail.com"],
        previous_customer_id:
          customerUserByEmail["sanduni.rathnayake@gmail.com"],
        detached_at: null,
      },
    });

    await prisma.vehicleTransferRequest.create({
      data: {
        vehicle_id: vehicleIdByPlate["CAF-5567"],
        requester_id: customerUserByEmail["nuwan.dissanayake@gmail.com"],
        current_owner_id: customerUserByEmail["amaya.senanayake@gmail.com"],
        contact_phone: "+94770100008",
        status: "Rejected",
        source: "Customer",
        reviewer_id: managerUser.user_id,
        reviewed_at: new Date("2026-07-29"),
        rejection_reason: "Insufficient proof of ownership provided.",
      },
    });
    console.log(
      "✅ Vehicle transfer requests seeded (1 pending, 1 approved, 1 rejected)",
    );

    // Detached vehicle — Kavindu's Swift, removed from his account and left unclaimed
    // (no unresolved bookings on it, so this doesn't fight the detach rule).
    await prisma.vehicle.update({
      where: { plate_no: "CAM-9912" },
      data: {
        customer_id: null,
        previous_customer_id:
          customerUserByEmail["kavindu.weerasinghe@gmail.com"],
        detached_at: new Date("2026-08-01"),
      },
    });
    console.log("✅ Detached vehicle seeded (1)");
  } else {
    console.log("✅ Demo bookings/history already exist");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
