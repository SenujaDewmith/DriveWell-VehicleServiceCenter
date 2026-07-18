// Package-aware appointment window generation: business hours are chunked into
// back-to-back windows sized to a specific package's estimated_duration, skipping
// any window that overlaps a blocked (recurring or one-off) time range.

const timeStrToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const dateColToMinutes = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();

const minutesToTimeDate = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return new Date(`1970-01-01T${h}:${m}:00.000Z`);
};

const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

// Blocked ranges applicable to a given date: recurring (date=null, every working day) + one-off (that exact date)
const getBlockedRangesForDate = async (client, dateStr) => {
  const rows = await client.blockedTime.findMany({
    where: { OR: [{ date: null }, { date: new Date(dateStr) }] },
  });
  return rows
    .map((r) => ({ start: dateColToMinutes(r.start_time), end: dateColToMinutes(r.end_time), reason: r.reason }))
    .sort((a, b) => a.start - b.start);
};

// Chunk [dayStartMin, dayEndMin) into back-to-back windows of durationMin,
// skipping over any window that overlaps a blocked range (jumps past it, no gap-filling).
const generateWindows = (dayStartMin, dayEndMin, durationMin, blockedRanges) => {
  const windows = [];
  let cursor = dayStartMin;
  while (cursor + durationMin <= dayEndMin) {
    const windowEnd = cursor + durationMin;
    const overlapping = blockedRanges.find((b) => cursor < b.end && windowEnd > b.start);
    if (overlapping) {
      cursor = overlapping.end;
      continue;
    }
    windows.push({ start: cursor, end: windowEnd });
    cursor = windowEnd;
  }
  return windows;
};

// True if two [start,end) minute ranges overlap
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

// Minimum notice required before an appointment's start time — no last-minute or already-passed bookings
const MIN_LEAD_MINUTES = 60;

// Server's current local date key ("YYYY-MM-DD") and minutes-since-midnight, for filtering
// out past/too-soon windows on today's date. Assumes server clock matches the business's timezone.
const getLocalNow = () => {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return { todayKey, nowMinutes };
};

module.exports = {
  timeStrToMinutes, dateColToMinutes, minutesToTimeDate, minutesToHHMM,
  getBlockedRangesForDate, generateWindows, rangesOverlap,
  MIN_LEAD_MINUTES, getLocalNow,
};
