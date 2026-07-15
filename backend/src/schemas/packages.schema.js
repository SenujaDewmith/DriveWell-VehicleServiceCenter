const { z } = require("zod");

const packageSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  description: z
    .string({ required_error: "Description is required" })
    .min(1, "Description is required")
    .trim(),
  estimated_duration: z
    .number({ required_error: "Duration is required", invalid_type_error: "Duration must be a number" })
    .int("Duration must be a whole number")
    .min(30, "Duration must be at least 30 minutes"),
  price: z
    .number({ required_error: "Price is required", invalid_type_error: "Price must be a number" })
    .min(1, "Price must be at least LKR 1"),
  max_capacity: z
    .number({ invalid_type_error: "Max capacity must be a number" })
    .int("Max capacity must be a whole number")
    .min(1, "Max capacity must be at least 1")
    .optional()
    .default(3),
});

module.exports = { packageSchema };
