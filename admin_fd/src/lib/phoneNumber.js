// Sri Lankan mobile numbers in international form: a fixed "+94" prefix (shown as a
// locked label, never typed by the user) followed by exactly 9 local digits,
// e.g. "+94771234567". Mirrors customer_fd/src/lib/phoneNumber.js — keep both in sync.
const SL_PHONE_REGEX = /^\+94\d{9}$/;
export function isValidSriLankanPhone(phone) {
  return SL_PHONE_REGEX.test((phone ?? "").trim());
}
// Normalizes any of "+94771234567", "94771234567", "0771234567" (local format), or a
// bare "771234567" down to just the 9 local digits — the only thing the input itself
// ever holds. See customer_fd's version for the full rationale.
export function toPhoneDigits(raw) {
  const value = raw ?? "";
  if (value.startsWith("+94")) return value.slice(3, 12);
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("94") && digits.length > 9) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  return digits.slice(0, 9);
}
export function joinPhoneNo(digits) {
  return digits ? `+94${digits}` : "";
}
export { SL_PHONE_REGEX };
