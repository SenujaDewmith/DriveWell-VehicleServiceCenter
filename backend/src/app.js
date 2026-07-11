const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const cookieParser = require("cookie-parser");
const swaggerSpec = require("./config/swagger");

// Routes
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const vehiclesRoutes = require("./routes/vehicles.routes");
const packagesRoutes = require("./routes/packages.routes");
const configRoutes = require("./routes/config.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const serviceRecordsRoutes = require("./routes/service-records.routes");
const invoicesRoutes = require("./routes/invoices.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const reportsRoutes = require("./routes/reports.routes");
const usersRoutes = require("./routes/users.routes");
const staffRoutes = require("./routes/staff.routes");

const app = express();

// CORS — in development allow any localhost port; in production lock to explicit origins
const productionOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:3001",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin))
        return callback(null, true);
      if (productionOrigins.includes(origin)) return callback(null, true);
      callback(new Error("CORS not allowed for origin: " + origin));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { withCredentials: true },
    customSiteTitle: "DriveWell API Docs",
  }),
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/config", configRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/service-records", serviceRecordsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/staff", staffRoutes);

// Health check
app.get("/", (req, res) =>
  res.json({ message: "DriveWell API is running 🚗" }),
);

module.exports = app;
