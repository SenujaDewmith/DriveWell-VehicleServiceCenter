const pool = require("../config/db");

const runMigrations = async () => {
  try {
    // 1. ROLES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id   SERIAL PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL
      );
    `);
    await pool.query(`
      INSERT INTO roles (role_name)
      VALUES ('Service Center Manager'), ('Supervisor'), ('Cashier'), ('Service Staff'), ('Customer')
      ON CONFLICT (role_name) DO NOTHING;
    `);
    console.log("✅ Roles ready");

    // 2. USERS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id        SERIAL PRIMARY KEY,
        email          VARCHAR(150) UNIQUE NOT NULL,
        password_hash  VARCHAR(255) NOT NULL,
        role_id        INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
        account_status VARCHAR(30) DEFAULT 'active',
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Users ready");

    // 3. STAFF PROFILES (Manager, Supervisor, Cashier, Service Staff)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        user_id   INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        phone_no  VARCHAR(20)
      );
    `);
    console.log("✅ Staff ready");

    // 4. CUSTOMER PROFILES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        user_id   INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        phone     VARCHAR(20),
        address   TEXT
      );
    `);
    console.log("✅ Customers ready");

    // 5. VEHICLES (owned by customers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_id  SERIAL PRIMARY KEY,
        customer_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        make        VARCHAR(100) NOT NULL,
        model       VARCHAR(100) NOT NULL,
        year        INT,
        plate_no    VARCHAR(30) UNIQUE NOT NULL,
        color       VARCHAR(50),
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Vehicles ready");

    // 6. SERVICE PACKAGES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_packages (
        package_id         SERIAL PRIMARY KEY,
        name               VARCHAR(150) NOT NULL,
        description        TEXT,
        estimated_duration INT NOT NULL DEFAULT 60,
        price              NUMERIC(10,2) NOT NULL,
        is_active          BOOLEAN DEFAULT TRUE,
        created_at         TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Service packages ready");

    // 7. WORKING CONFIG (single-row table, seeded on first run)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS working_config (
        config_id      SERIAL PRIMARY KEY,
        daily_capacity INT NOT NULL DEFAULT 10,
        working_days   TEXT NOT NULL DEFAULT '1,2,3,4,5'
      );
    `);
    await pool.query(`
      INSERT INTO working_config (daily_capacity, working_days)
      SELECT 10, '1,2,3,4,5'
      WHERE NOT EXISTS (SELECT 1 FROM working_config);
    `);
    console.log("✅ Working config ready");

    // 8. TIME SLOTS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_slots (
        slot_id    SERIAL PRIMARY KEY,
        slot_time  TIME NOT NULL,
        is_active  BOOLEAN DEFAULT TRUE
      );
    `);
    await pool.query(`
      INSERT INTO time_slots (slot_time)
      SELECT unnest(ARRAY['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00']::TIME[])
      WHERE NOT EXISTS (SELECT 1 FROM time_slots);
    `);
    console.log("✅ Time slots ready");

    // 9. RESERVATIONS (bookings)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        reservation_id SERIAL PRIMARY KEY,
        booking_ref    VARCHAR(20) UNIQUE,
        customer_id    INT NOT NULL REFERENCES users(user_id),
        vehicle_id     INT NOT NULL REFERENCES vehicles(vehicle_id),
        package_id     INT NOT NULL REFERENCES service_packages(package_id),
        slot_id        INT REFERENCES time_slots(slot_id),
        service_date   DATE NOT NULL,
        status         VARCHAR(30) DEFAULT 'Booked',
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Reservations ready");

    // 10. SERVICE RECORDS (created by supervisor when work begins)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_records (
        record_id          SERIAL PRIMARY KEY,
        reservation_id     INT UNIQUE NOT NULL REFERENCES reservations(reservation_id) ON DELETE CASCADE,
        supervisor_id      INT REFERENCES users(user_id),
        remarks            TEXT,
        additional_work    TEXT,
        consumables        TEXT,
        additional_charges NUMERIC(10,2) DEFAULT 0,
        quality_checked    BOOLEAN DEFAULT FALSE,
        started_at         TIMESTAMP,
        completed_at       TIMESTAMP
      );
    `);
    console.log("✅ Service records ready");

    // 11. STAFF ASSIGNMENTS (which staff did which task on a service)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_staff_assignments (
        assignment_id SERIAL PRIMARY KEY,
        record_id     INT NOT NULL REFERENCES service_records(record_id) ON DELETE CASCADE,
        staff_id      INT NOT NULL REFERENCES users(user_id),
        task_type     VARCHAR(100),
        UNIQUE(record_id, staff_id, task_type)
      );
    `);
    console.log("✅ Staff assignments ready");

    // 12. INVOICES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_id         SERIAL PRIMARY KEY,
        reservation_id     INT UNIQUE NOT NULL REFERENCES reservations(reservation_id),
        cashier_id         INT REFERENCES users(user_id),
        base_amount        NUMERIC(10,2) NOT NULL,
        additional_charges NUMERIC(10,2) DEFAULT 0,
        discount           NUMERIC(10,2) DEFAULT 0,
        total_amount       NUMERIC(10,2) NOT NULL,
        payment_status     VARCHAR(20) DEFAULT 'Unpaid',
        payment_method     VARCHAR(30),
        notes              TEXT,
        generated_at       TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Invoices ready");

    // 13. FEEDBACK
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        feedback_id    SERIAL PRIMARY KEY,
        reservation_id INT UNIQUE NOT NULL REFERENCES reservations(reservation_id),
        customer_id    INT NOT NULL REFERENCES users(user_id),
        rating         INT CHECK (rating >= 1 AND rating <= 5),
        comment        TEXT,
        submitted_at   TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Feedback ready");

    // 14. ACTIVITY LOG
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        log_id      SERIAL PRIMARY KEY,
        user_id     INT REFERENCES users(user_id),
        action      VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50),
        entity_id   INT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Activity log ready");

    console.log("✅ All migrations complete");
  } catch (error) {
    console.error("❌ Migration error:", error.message);
    process.exit(1);
  }
};

module.exports = runMigrations;
