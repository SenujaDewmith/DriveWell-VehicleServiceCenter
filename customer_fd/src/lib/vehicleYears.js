const MIN_YEAR = 1980;
const MAX_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i).map((y) => ({ value: y.toString(), label: y.toString() }));
