// Deliberately permissive — this codebase has no strict phone validation anywhere
// else; this is a light sanity check (not full E.164), used only for the
// newer contact-facing fields (secondary phone, transfer-request contact phone).
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

const isValidPhone = (value) => typeof value === "string" && PHONE_REGEX.test(value.trim());

// Sri Lankan mobile in international form only — e.g. +94771234567. Fixed "+94" prefix
// plus exactly 9 local digits, nothing else. Mirrors SL_PHONE_REGEX in
// customer_fd/src/lib/phoneNumber.js — keep both in sync. Used for fields whose UI locks
// the "+94" prefix and only lets the user type the 9 digits (customer profile phone,
// the admin-configurable service center contact number).
const SL_PHONE_REGEX = /^\+94\d{9}$/;

const isValidSriLankanPhone = (value) => typeof value === "string" && SL_PHONE_REGEX.test(value.trim());

module.exports = { isValidPhone, isValidSriLankanPhone, SL_PHONE_REGEX };
