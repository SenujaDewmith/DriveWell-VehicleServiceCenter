const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DriveWell – Vehicle Service Management API",
      version: "1.0.0",
      description: "Complete REST API for DriveWell vehicle service center management system. Supports five user roles: Customer, Service Center Manager, Supervisor/Inspector, Cashier, Service Staff.",
    },
    servers: [{ url: "http://localhost:3000", description: "Local development server" }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
        },
      },
      schemas: {
        // ── Shared ──────────────────────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Something went wrong" },
          },
        },
        // ── Auth ────────────────────────────────────────────────
        CustomerProfile: {
          type: "object",
          properties: {
            full_name: { type: "string", example: "John Doe" },
            phone:     { type: "string", example: "+94771234567" },
            address:   { type: "string", example: "42 Main Street, Colombo" },
          },
        },
        StaffProfile: {
          type: "object",
          properties: {
            full_name: { type: "string", example: "Sarah Perera" },
            phone_no:  { type: "string", example: "+94712345678" },
          },
        },
        // ── Vehicles ────────────────────────────────────────────
        Vehicle: {
          type: "object",
          properties: {
            vehicle_id:  { type: "integer", example: 1 },
            customer_id: { type: "integer", example: 5 },
            make:        { type: "string",  example: "Toyota" },
            model:       { type: "string",  example: "Corolla" },
            year:        { type: "integer", example: 2020 },
            plate_no:    { type: "string",  example: "CAB-1234" },
            color:       { type: "string",  example: "White" },
            created_at:  { type: "string",  format: "date-time" },
          },
        },
        VehicleInput: {
          type: "object",
          required: ["make", "model", "plate_no"],
          properties: {
            make:     { type: "string",  example: "Toyota" },
            model:    { type: "string",  example: "Corolla" },
            year:     { type: "integer", example: 2020 },
            plate_no: { type: "string",  example: "CAB-1234" },
            color:    { type: "string",  example: "White" },
          },
        },
        // ── Service Packages ────────────────────────────────────
        ServicePackage: {
          type: "object",
          properties: {
            package_id:         { type: "integer", example: 1 },
            name:               { type: "string",  example: "Full Service" },
            description:        { type: "string",  example: "Complete vehicle service including oil change, filter replacement, and inspection." },
            estimated_duration: { type: "integer", example: 120, description: "Duration in minutes" },
            price:              { type: "number",  example: 4500.00 },
            is_active:          { type: "boolean", example: true },
            created_at:         { type: "string",  format: "date-time" },
          },
        },
        ServicePackageInput: {
          type: "object",
          required: ["name", "estimated_duration", "price"],
          properties: {
            name:               { type: "string",  example: "Full Service" },
            description:        { type: "string",  example: "Complete vehicle service" },
            estimated_duration: { type: "integer", example: 120 },
            price:              { type: "number",  example: 4500.00 },
          },
        },
        // ── Time Slots ──────────────────────────────────────────
        TimeSlot: {
          type: "object",
          properties: {
            slot_id:   { type: "integer", example: 1 },
            slot_time: { type: "string",  example: "08:00:00" },
            is_active: { type: "boolean", example: true },
          },
        },
        // ── Working Config ──────────────────────────────────────
        WorkingConfig: {
          type: "object",
          properties: {
            config_id:      { type: "integer", example: 1 },
            daily_capacity: { type: "integer", example: 10 },
            working_days:   { type: "string",  example: "1,2,3,4,5", description: "Comma-separated day numbers: 0=Sun, 1=Mon ... 6=Sat" },
          },
        },
        // ── Reservations ────────────────────────────────────────
        Reservation: {
          type: "object",
          properties: {
            reservation_id: { type: "integer", example: 1 },
            booking_ref:    { type: "string",  example: "DW-2025-00001" },
            customer_id:    { type: "integer", example: 5 },
            vehicle_id:     { type: "integer", example: 2 },
            package_id:     { type: "integer", example: 1 },
            slot_id:        { type: "integer", example: 3 },
            service_date:   { type: "string",  format: "date", example: "2025-06-15" },
            status:         { type: "string",  example: "Booked", enum: ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup", "Cancelled", "No-show"] },
            created_at:     { type: "string",  format: "date-time" },
          },
        },
        ReservationInput: {
          type: "object",
          required: ["vehicle_id", "package_id", "service_date"],
          properties: {
            vehicle_id:   { type: "integer", example: 2 },
            package_id:   { type: "integer", example: 1 },
            slot_id:      { type: "integer", example: 3 },
            service_date: { type: "string",  format: "date", example: "2025-06-15" },
          },
        },
        // ── Service Records ─────────────────────────────────────
        ServiceRecord: {
          type: "object",
          properties: {
            record_id:          { type: "integer", example: 1 },
            reservation_id:     { type: "integer", example: 1 },
            supervisor_id:      { type: "integer", example: 3 },
            remarks:            { type: "string",  example: "Oil changed, filters replaced" },
            additional_work:    { type: "string",  example: "Replaced brake pads" },
            consumables:        { type: "string",  example: "5W-30 engine oil, air filter" },
            additional_charges: { type: "number",  example: 1500.00 },
            quality_checked:    { type: "boolean", example: false },
            started_at:         { type: "string",  format: "date-time" },
            completed_at:       { type: "string",  format: "date-time" },
          },
        },
        // ── Invoices ────────────────────────────────────────────
        Invoice: {
          type: "object",
          properties: {
            invoice_id:         { type: "integer", example: 1 },
            reservation_id:     { type: "integer", example: 1 },
            cashier_id:         { type: "integer", example: 4 },
            base_amount:        { type: "number",  example: 4500.00 },
            additional_charges: { type: "number",  example: 1500.00 },
            discount:           { type: "number",  example: 200.00 },
            total_amount:       { type: "number",  example: 5800.00 },
            payment_status:     { type: "string",  example: "Unpaid", enum: ["Paid", "Unpaid"] },
            payment_method:     { type: "string",  example: "Cash" },
            notes:              { type: "string",  example: "Loyalty discount applied" },
            generated_at:       { type: "string",  format: "date-time" },
          },
        },
        InvoiceInput: {
          type: "object",
          required: ["reservation_id", "base_amount"],
          properties: {
            reservation_id:     { type: "integer", example: 1 },
            base_amount:        { type: "number",  example: 4500.00 },
            additional_charges: { type: "number",  example: 1500.00 },
            discount:           { type: "number",  example: 200.00 },
            payment_method:     { type: "string",  example: "Cash" },
            notes:              { type: "string",  example: "" },
          },
        },
        // ── Feedback ────────────────────────────────────────────
        Feedback: {
          type: "object",
          properties: {
            feedback_id:    { type: "integer", example: 1 },
            reservation_id: { type: "integer", example: 1 },
            customer_id:    { type: "integer", example: 5 },
            rating:         { type: "integer", example: 4, minimum: 1, maximum: 5 },
            comment:        { type: "string",  example: "Great service, very professional." },
            submitted_at:   { type: "string",  format: "date-time" },
          },
        },
        FeedbackInput: {
          type: "object",
          required: ["reservation_id", "rating"],
          properties: {
            reservation_id: { type: "integer", example: 1 },
            rating:         { type: "integer", example: 4, minimum: 1, maximum: 5 },
            comment:        { type: "string",  example: "Great service!" },
          },
        },
        // ── Staff ───────────────────────────────────────────────
        StaffUser: {
          type: "object",
          properties: {
            user_id:        { type: "integer", example: 3 },
            email:          { type: "string",  example: "supervisor@drivewell.lk" },
            role_id:        { type: "integer", example: 2 },
            role_name:      { type: "string",  example: "Supervisor" },
            account_status: { type: "string",  example: "active" },
            full_name:      { type: "string",  example: "Kasun Silva" },
            phone_no:       { type: "string",  example: "+94711234567" },
          },
        },
        CreateStaffInput: {
          type: "object",
          required: ["email", "password", "full_name", "role_id"],
          properties: {
            email:     { type: "string",  example: "newstaff@drivewell.lk" },
            password:  { type: "string",  example: "securepass123" },
            full_name: { type: "string",  example: "Nimal Perera" },
            role_id:   { type: "integer", example: 4, description: "1=Manager, 2=Supervisor, 3=Cashier, 4=Service Staff" },
            phone_no:  { type: "string",  example: "+94771234567" },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
