const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Vehicle Service Management API",
      version: "1.0.0",
      description: "API documentation for Vehicle Service Management System",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      // ✅ Cookie-based auth scheme (replaces bearerAuth)
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token", // must match the cookie name in res.cookie("token", ...)
        },
      },
      // ✅ Reusable schemas — no need for a separate file
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Something went wrong",
            },
          },
        },
      },
    },
    // ✅ Apply cookieAuth globally to all routes
    security: [{ cookieAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
