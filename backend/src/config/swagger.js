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
            vehicle_id:      { type: "integer", example: 1 },
            customer_id:     { type: "integer", example: 5 },
            make_id:         { type: "integer", example: 1 },
            make:            { type: "string",  example: "Toyota" },
            model_id:        { type: "integer", example: 56 },
            model:           { type: "string",  example: "Corolla" },
            vehicle_type_id: { type: "integer", example: 1 },
            vehicle_type:    { type: "string",  example: "Car" },
            year:            { type: "integer", example: 2020 },
            plate_no:        { type: "string",  example: "CAB-1234" },
            created_at:      { type: "string",  format: "date-time" },
          },
        },
        VehicleInput: {
          type: "object",
          required: ["make_id", "model_id", "vehicle_type_id", "plate_no"],
          properties: {
            make_id:         { type: "integer", example: 1 },
            model_id:        { type: "integer", example: 56 },
            vehicle_type_id: { type: "integer", example: 1 },
            year:            { type: "integer", example: 2020 },
            plate_no:        { type: "string",  example: "CAB-1234" },
          },
        },
        // ── Service Packages ────────────────────────────────────
        ServicePackage: {
          type: "object",
          properties: {
            package_id:         { type: "integer", example: 1 },
            name:               { type: "string",  example: "Full Service" },
            package_code:       { type: "string",  example: "DWP-001", description: "Manually assigned reference code, always prefixed DWP-" },
            description:        { type: "string",  example: "Complete vehicle service including oil change, filter replacement, and inspection." },
            estimated_duration: { type: "integer", example: 120, description: "Duration in minutes" },
            price:              { type: "number",  example: 4500.00 },
            is_active:          { type: "boolean", example: true },
            created_at:         { type: "string",  format: "date-time" },
          },
        },
        ServicePackageInput: {
          type: "object",
          required: ["name", "package_code", "estimated_duration", "price"],
          properties: {
            name:               { type: "string",  example: "Full Service" },
            package_code:       { type: "string",  example: "DWP-001", description: "Must start with DWP- followed by 1-16 letters/numbers/hyphens" },
            description:        { type: "string",  example: "Complete vehicle service" },
            estimated_duration: { type: "integer", example: 120 },
            price:              { type: "number",  example: 4500.00 },
            max_capacity:       { type: "integer", example: 3, description: "Concurrent bookings of this package allowed at once" },
          },
        },
        // ── Working Config & Blocked Times ───────────────────────
        WorkingConfig: {
          type: "object",
          properties: {
            config_id:      { type: "integer", example: 1 },
            working_days:   { type: "string",  example: "1,2,3,4,5", description: "Comma-separated day numbers: 0=Sun, 1=Mon ... 6=Sat" },
            day_start_time: { type: "string",  example: "08:00:00" },
            day_end_time:   { type: "string",  example: "18:00:00" },
          },
        },
        BlockedTime: {
          type: "object",
          properties: {
            block_id:   { type: "integer", example: 1 },
            date:       { type: "string",  format: "date", nullable: true, example: null, description: "null = recurring, applies every working day (e.g. lunch break)" },
            start_time: { type: "string",  example: "12:00:00" },
            end_time:   { type: "string",  example: "13:00:00" },
            reason:     { type: "string",  example: "Lunch break", nullable: true },
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
            start_time:     { type: "string",  example: "08:00:00" },
            end_time:       { type: "string",  example: "09:30:00" },
            service_date:   { type: "string",  format: "date", example: "2025-06-15" },
            status:         { type: "string",  example: "Booked", enum: ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup", "Cancelled", "No-show"] },
            created_at:     { type: "string",  format: "date-time" },
          },
        },
        ReservationInput: {
          type: "object",
          required: ["vehicle_id", "package_id", "service_date", "start_time", "terms_accepted", "terms_version"],
          properties: {
            vehicle_id:     { type: "integer", example: 2 },
            package_id:     { type: "integer", example: 1 },
            service_date:   { type: "string",  format: "date", example: "2025-06-15" },
            start_time:     { type: "string",  example: "08:00", description: "HH:MM — must match one of the package's generated appointment windows for that date" },
            terms_accepted: { type: "boolean", example: true, description: "Must be true — explicit clickwrap consent to the Terms & Conditions" },
            terms_version:  { type: "string",  example: "1.0", description: "T&C version shown to the customer — must match the current version" },
          },
        },
        // ── Charge Catalog ──────────────────────────────────────
        ChargeCatalogItem: {
          type: "object",
          properties: {
            catalog_item_id: { type: "integer", example: 1 },
            name:            { type: "string",  example: "Brake Pad Replacement (Front)" },
            description:     { type: "string",  example: "Includes pads and labor" },
            default_price:   { type: "number",  example: 3500.00 },
            category:        { type: "string",  example: "Parts" },
            is_active:       { type: "boolean", example: true },
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
            quality_checked:    { type: "boolean", example: false },
            started_at:         { type: "string",  format: "date-time" },
            completed_at:       { type: "string",  format: "date-time" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id:            { type: "integer", example: 1 },
                  catalog_item_id:    { type: "integer", example: 1 },
                  catalog_item_name:  { type: "string",  example: "Brake Pad Replacement (Front)" },
                  description:        { type: "string",  example: "Rear brake pads worn — needs replacement" },
                  quantity:           { type: "integer", example: 1 },
                },
              },
            },
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
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  invoice_item_id: { type: "integer", example: 1 },
                  catalog_item_id: { type: "integer", example: 1 },
                  description:     { type: "string",  example: "Brake Pad Replacement (Front)" },
                  unit_price:      { type: "number",  example: 3500.00 },
                  quantity:        { type: "integer", example: 1 },
                  line_total:      { type: "number",  example: 3500.00 },
                },
              },
            },
          },
        },
        InvoiceInput: {
          type: "object",
          required: ["reservation_id", "base_amount"],
          properties: {
            reservation_id: { type: "integer", example: 1 },
            base_amount:    { type: "number",  example: 4500.00 },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["description", "unit_price"],
                properties: {
                  catalog_item_id: { type: "integer", example: 1 },
                  description:     { type: "string",  example: "Brake Pad Replacement (Front)" },
                  unit_price:      { type: "number",  example: 3500.00 },
                  quantity:        { type: "integer", example: 1 },
                },
              },
            },
            discount:       { type: "number",  example: 200.00 },
            payment_method: { type: "string",  example: "Cash" },
            notes:          { type: "string",  example: "" },
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
