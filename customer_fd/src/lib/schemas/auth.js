import { z } from "zod";
export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Please enter a valid password"),
});
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password must be at most 64 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9\s]/,
    "Password must contain at least one special character",
  )
  .refine((value) => !/\s/.test(value), "Password must not contain spaces");
export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });
// Sri Lankan mobile in international form only — e.g. +94771234567. Fixed "+94"
// prefix plus exactly 9 local digits, nothing else. The prefix is locked in the UI
// (PhoneNumberInput) rather than typed, so this is the backstop, not the primary guard.
const SL_PHONE_REGEX = /^\+94\d{9}$/;
const phoneSchema = z
  .string()
  .trim()
  .regex(SL_PHONE_REGEX, "Enter a valid 9-digit number after +94");
const optionalPhoneSchema = z
  .string()
  .trim()
  .regex(SL_PHONE_REGEX, "Enter a valid 9-digit number after +94")
  .optional()
  .or(z.literal(""));
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  phone: phoneSchema,
  secondaryPhone: optionalPhoneSchema,
});
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });
