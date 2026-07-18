const { z } = require("zod");

const chargeCatalogItemSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(1, "Name is required")
    .max(150, "Name must be 150 characters or less")
    .trim(),
  description: z.string().trim().optional().nullable(),
  default_price: z
    .number({ required_error: "Default price is required", invalid_type_error: "Default price must be a number" })
    .min(0, "Default price cannot be negative"),
  category: z.string().trim().max(50, "Category must be 50 characters or less").optional().nullable(),
});

module.exports = { chargeCatalogItemSchema };
