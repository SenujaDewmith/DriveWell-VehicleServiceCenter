const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const cookieParser = require("cookie-parser");
const swaggerSpec = require("./config/swagger");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(
  cors({
    origin: "http://localhost:8080", // must be explicit, NOT "*"
    credentials: true, // must be true
  }),
);

app.use(express.json());
app.use(cookieParser());

// Swagger UI route
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      withCredentials: true, // ← this is the fix
    },
  }),
);

// API Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/", (req, res) =>
  res.json({ message: "Vehicle Service API is running 🚗" }),
);

module.exports = app;
