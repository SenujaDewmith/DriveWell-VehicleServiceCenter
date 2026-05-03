const pool = require("../config/db");

const runMigrations = async () => {
  try {
    // 1. ROLES TABLE — created first because users depends on it
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id   SERIAL PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL
      );
    `);
    console.log("✅ Roles table ready");

    // Seed default roles (skips if they already exist)
    await pool.query(`
      INSERT INTO roles (role_name)
      VALUES ('Service Center Manager'), ('Supervisor'), ('Cashier'), ('Service Staff'), ('Customer')
      ON CONFLICT (role_name) DO NOTHING;
    `);
    console.log("✅ Default roles seeded");

    // 2. CENTRAL USERS TABLE — handles all authentication
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
    console.log("✅ Users table ready");

    // 3. STAFF PROFILE TABLE — 1-to-1 with users (Admin, Manager, Mechanic)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        user_id   INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        phone_no  VARCHAR(20)
      );
    `);
    console.log("✅ Staff table ready");

    // 4. CUSTOMER PROFILE TABLE — 1-to-1 with users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        user_id   INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        phone     VARCHAR(20),
        address   TEXT
      );
    `);
    console.log("✅ Customers table ready");
  } catch (error) {
    console.error("❌ Migration error:", error.message);
    process.exit(1);
  }
};

module.exports = runMigrations;
