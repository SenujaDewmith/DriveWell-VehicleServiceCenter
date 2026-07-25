const { z } = require("zod");

const vehicleMakeSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
});

const vehicleModelSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(150, "Name must be 150 characters or less"),
  make_id: z.number({ required_error: "make_id is required", invalid_type_error: "make_id must be a number" }).int().positive(),
  vehicle_type_id: z.number().int().positive().optional().nullable(),
  start_year: z.number().int().optional().nullable(),
  end_year: z.number().int().optional().nullable(),
});

const vehicleTypeSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
});

const resolvePendingSchema = z.object({
  vehicle_ids: z
    .array(z.number({ invalid_type_error: "vehicle_ids must be numbers" }).int().positive())
    .min(1, "At least one vehicle_id is required"),
  make_id: z.number({ required_error: "make_id is required", invalid_type_error: "make_id must be a number" }).int().positive(),
  model_id: z.number({ required_error: "model_id is required", invalid_type_error: "model_id must be a number" }).int().positive(),
});

module.exports = { vehicleMakeSchema, vehicleModelSchema, vehicleTypeSchema, resolvePendingSchema };
