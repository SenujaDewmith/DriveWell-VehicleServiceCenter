// Sri Lankan vehicle registration plates: a 2-3 character prefix (letters for
// most vehicles, e.g. "KA" / "CAB"; digits for some older registrations, e.g.
// "65") followed by a hyphen and exactly 4 digits, e.g. "KA-1234", "CAB-1234",
// "65-8790".
const PLATE_PREFIX_REGEX = /^(?:[A-Z]{2,3}|[0-9]{2,3})$/;
const PLATE_SUFFIX_REGEX = /^\d{4}$/;
const SRI_LANKA_PLATE_REGEX = /^(?:[A-Z]{2,3}|[0-9]{2,3})-\d{4}$/;
export function isValidSriLankanPlate(plate) {
    return SRI_LANKA_PLATE_REGEX.test(plate.trim().toUpperCase());
}
export function splitPlateNo(plate) {
    const [prefix = "", suffix = ""] = plate.trim().toUpperCase().split("-");
    return { prefix, suffix };
}
export function joinPlateNo(prefix, suffix) {
    return suffix ? `${prefix}-${suffix}` : prefix;
}
export function sanitizePlatePrefix(raw) {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}
export function sanitizePlateSuffix(raw) {
    return raw.replace(/[^0-9]/g, "").slice(0, 4);
}
export { PLATE_PREFIX_REGEX, PLATE_SUFFIX_REGEX };
