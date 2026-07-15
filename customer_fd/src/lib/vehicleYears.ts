const MIN_YEAR = 1980;

export const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 1 - MIN_YEAR + 1 },
  (_, i) => new Date().getFullYear() + 1 - i,
).map((y) => ({ value: y.toString(), label: y.toString() }));
