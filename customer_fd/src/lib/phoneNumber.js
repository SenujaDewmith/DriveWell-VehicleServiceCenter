// Sri Lankan mobile numbers in international form: a fixed "+94" prefix (shown as a
// locked label, never typed by the user) followed by exactly 9 local digits,
// e.g. "+94771234567". Must match SL_PHONE_REGEX in customer_fd/src/lib/schemas/auth.js.
const SL_PHONE_REGEX = /^\+94\d{9}$/;
export function isValidSriLankanPhone(phone) {
    return SL_PHONE_REGEX.test((phone ?? "").trim());
}
// Normalizes any of "+94771234567", "94771234567", "0771234567" (local format), or a
// bare "771234567" down to just the 9 local digits — the only thing the input itself
// ever holds. Used both to sanitize live keystrokes/pastes and to split a full stored
// value (e.g. loaded from a user record, possibly pre-dating this format) for display.
export function toPhoneDigits(raw) {
    const value = raw ?? "";
    // Deterministic, not a heuristic: once a value is already in our own "+94XXXXXXXXX"
    // shape — true for every keystroke after the first, since joinPhoneNo always produces
    // this shape — stripping the literal 3-char prefix is lossless. A digit-counting
    // heuristic here (e.g. "starts with 94 and is longer than 9 digits") breaks on
    // backspace: shrinking down to exactly 9 stripped digits makes the heuristic's own
    // length check fail, so it stops stripping and "94" from the country code gets kept
    // as if it were part of the real number.
    if (value.startsWith("+94"))
        return value.slice(3, 12);
    // Fallback for a value NOT yet in that shape — legacy stored data ("0771234567") from
    // before this format existed, or a paste (into either the digit box or, on first load,
    // the full field) that included a local leading 0 or a plus-less "94". Only ever
    // exercised once, parsing a value this component didn't itself produce.
    let digits = value.replace(/[^0-9]/g, "");
    if (digits.startsWith("94") && digits.length > 9)
        digits = digits.slice(2);
    else if (digits.startsWith("0") && digits.length === 10)
        digits = digits.slice(1);
    return digits.slice(0, 9);
}
export function joinPhoneNo(digits) {
    return digits ? `+94${digits}` : "";
}
export { SL_PHONE_REGEX };
