// Local calendar date as YYYY-MM-DD — matches what a <input type="date">
// produces, and avoids the UTC-shift bugs of Date#toISOString() for
// timezones ahead of UTC (e.g. a holiday added at 1am local time shouldn't
// be treated as "yesterday").
export function toLocalISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fmt12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDateShort(date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
