// Deliberately permissive — this codebase has no phone validation anywhere
// else; this is a light sanity check (not full E.164), used only for the
// newer contact-facing fields (secondary phone, transfer-request contact phone).
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

const isValidPhone = (value) => typeof value === "string" && PHONE_REGEX.test(value.trim());

module.exports = { isValidPhone };
