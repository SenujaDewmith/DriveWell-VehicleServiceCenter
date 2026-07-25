// Sri Lankan vehicle registration plates: a 2-3 character prefix (letters for
// most vehicles, e.g. "KA" / "CAB"; digits for some older registrations, e.g.
// "65") followed by a hyphen and exactly 4 digits, e.g. "KA-1234", "CAB-1234",
// "65-8790".
const SRI_LANKA_PLATE_REGEX = /^(?:[A-Z]{2,3}|[0-9]{2,3})-\d{4}$/;

export function isValidSriLankanPlate(plate: string): boolean {
  return SRI_LANKA_PLATE_REGEX.test(plate.trim().toUpperCase());
}

export function splitPlateNo(plate: string): { prefix: string; suffix: string } {
  const [prefix = "", suffix = ""] = plate.trim().toUpperCase().split("-");
  return { prefix, suffix };
}

export function joinPlateNo(prefix: string, suffix: string): string {
  return suffix ? `${prefix}-${suffix}` : prefix;
}

export function sanitizePlatePrefix(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

export function sanitizePlateSuffix(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 4);
}
