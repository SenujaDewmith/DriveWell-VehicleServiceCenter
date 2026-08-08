import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import { api } from "@/lib/api";
import { toLocalISODate, fmt12h } from "@/lib/date";
import { DataCard, DataCardField } from "@/components/ui/data-card";
import { SlotAvailability } from "@/components/schedule/SlotAvailability";

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_TO_NUM = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
const NUM_TO_DAY = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function subtractMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m - minutes;
  total = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function toHHMM(t) {
  return t.slice(0, 5);
}

function todayISODate() {
  return toLocalISODate(new Date());
}

// A holiday is a blocked time that spans the entire day for a specific date
function isHoliday(b) {
  return b.date !== null && toHHMM(b.start_time) === "00:00" && toHHMM(b.end_time) === "23:59";
}

// Order-independent — toggling a day off and back on appends it to the end of
// workingDays, which shouldn't by itself count as a change worth saving.
function sameDays(a, b) {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((day, i) => day === sorted[i]);
}

export function SchedulePage() {
  const [workingDays, setWorkingDays] = useState([]);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [cutoffHours, setCutoffHours] = useState(4);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [savedHours, setSavedHours] = useState(null);
  const [blockedTimes, setBlockedTimes] = useState([]);

  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockStart, setNewBlockStart] = useState("");
  const [newBlockEnd, setNewBlockEnd] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [editingBlockId, setEditingBlockId] = useState(null);

  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayReason, setNewHolidayReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/config")
      .then(({ config, blocked_times }) => {
        const days = config.working_days
          .split(",")
          .map((n) => NUM_TO_DAY[parseInt(n)])
          .filter(Boolean);
        const start = toHHMM(config.day_start_time);
        const end = toHHMM(config.day_end_time);
        const cutoff = config.same_day_cutoff_minutes / 60;
        const advanceDays = config.max_advance_days;
        setWorkingDays(days);
        setDayStart(start);
        setDayEnd(end);
        setCutoffHours(cutoff);
        setMaxAdvanceDays(advanceDays);
        setSavedHours({ workingDays: days, dayStart: start, dayEnd: end, cutoffHours: cutoff, maxAdvanceDays: advanceDays });
        setBlockedTimes(blocked_times);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleDay = (day) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const saveBusinessHours = async () => {
    if (!dayStart || !dayEnd) {
      setError("Start and end time are required");
      return;
    }
    if (dayEnd <= dayStart) {
      setError("End time must be after start time");
      return;
    }
    if (cutoffHours < 0) {
      setError("Same-day cutoff cannot be negative");
      return;
    }
    if (!Number.isInteger(maxAdvanceDays) || maxAdvanceDays < 1) {
      setError("Advance booking window must be a whole number of at least 1 day");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const working_days = workingDays
        .map((d) => DAY_TO_NUM[d])
        .sort((a, b) => a - b)
        .join(",");
      await api.put("/api/config", {
        working_days,
        day_start_time: dayStart,
        day_end_time: dayEnd,
        same_day_cutoff_minutes: Math.round(cutoffHours * 60),
        max_advance_days: maxAdvanceDays,
      });
      setSavedHours({ workingDays, dayStart, dayEnd, cutoffHours, maxAdvanceDays });
      setSuccess("Business hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetBlockForm = () => {
    setNewBlockDate("");
    setNewBlockStart("");
    setNewBlockEnd("");
    setNewBlockReason("");
    setEditingBlockId(null);
  };

  const startEditBlock = (b) => {
    setNewBlockDate(b.date ?? "");
    setNewBlockStart(toHHMM(b.start_time));
    setNewBlockEnd(toHHMM(b.end_time));
    setNewBlockReason(b.reason ?? "");
    setEditingBlockId(b.block_id);
    setError("");
  };

  const saveBlockedTime = async () => {
    if (!newBlockStart || !newBlockEnd) {
      setError("Start time and end time are required");
      return;
    }
    if (newBlockEnd <= newBlockStart) {
      setError("End time must be after start time");
      return;
    }
    setAddingBlock(true);
    setError("");
    try {
      const payload = {
        date: newBlockDate || undefined,
        start_time: newBlockStart,
        end_time: newBlockEnd,
        reason: newBlockReason || undefined,
      };
      if (editingBlockId) {
        await api.put(`/api/config/blocked-times/${editingBlockId}`, payload);
      } else {
        await api.post("/api/config/blocked-times", payload);
      }
      resetBlockForm();
      load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${editingBlockId ? "update" : "add"} blocked time`,
      );
    } finally {
      setAddingBlock(false);
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate) {
      setError("Date is required");
      return;
    }
    if (holidayDateError) {
      setError(holidayDateError);
      return;
    }
    setAddingHoliday(true);
    setError("");
    try {
      await api.post("/api/config/blocked-times", {
        date: newHolidayDate,
        start_time: "00:00",
        end_time: "23:59",
        reason: newHolidayReason || undefined,
      });
      setNewHolidayDate("");
      setNewHolidayReason("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holiday");
    } finally {
      setAddingHoliday(false);
    }
  };

  const removeBlockedTime = async (block) => {
    setError("");
    try {
      await api.delete(`/api/config/blocked-times/${block.block_id}`);
      if (editingBlockId === block.block_id) resetBlockForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove blocked time");
    }
  };

  const hoursChanged =
    savedHours !== null &&
    (!sameDays(workingDays, savedHours.workingDays) ||
      dayStart !== savedHours.dayStart ||
      dayEnd !== savedHours.dayEnd ||
      cutoffHours !== savedHours.cutoffHours ||
      maxAdvanceDays !== savedHours.maxAdvanceDays);

  const holidays = blockedTimes
    .filter(isHoliday)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const partialBlocks = blockedTimes.filter((b) => !isHoliday(b));

  // Validates the picked date before it ever reaches the server — a holiday
  // in the past is meaningless, and a duplicate just clutters the list.
  const holidayDateError = !newHolidayDate
    ? null
    : newHolidayDate < todayISODate()
      ? "Date can't be in the past"
      : holidays.some((h) => h.date === newHolidayDate)
        ? "This date is already marked as a holiday"
        : null;
  const isHolidayDateValid = Boolean(newHolidayDate) && !holidayDateError;

  // Same idea for the blocked-time form — only enable Add/Update once both
  // times are picked and end is actually after start.
  const blockTimeError =
    newBlockStart && newBlockEnd && newBlockEnd <= newBlockStart
      ? "End time must be after start time"
      : null;
  const isBlockTimeValid = Boolean(newBlockStart) && Boolean(newBlockEnd) && !blockTimeError;

  if (loading) {
    return <div className="text-sm text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Schedule Config</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-accent border border-accent/30 bg-accent/5 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Business Hours</h3>
          <button
            onClick={saveBusinessHours}
            disabled={saving || !hoursChanged}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Appointment windows are generated automatically for each service package based on its
          duration and these hours — you no longer need to create individual time slots.
        </p>

        <label className="block text-sm font-medium text-muted-foreground">Working Days</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                workingDays.includes(day)
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">Day Start</label>
            <input
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">Day End</label>
            <input
              type="time"
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">
              Same-Day Cutoff (hours before closing)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={cutoffHours}
              onChange={(e) => setCutoffHours(Number(e.target.value))}
              className="w-40 border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">
              Advance Booking Window (days)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
              className="w-40 border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {dayEnd && cutoffHours >= 0 && (
          <p className="text-sm text-accent">
            Same-day bookings will close at{" "}
            {fmt12h(subtractMinutes(dayEnd, Math.round(cutoffHours * 60)))} — after that, today
            becomes unavailable in the booking calendar.
          </p>
        )}
        {maxAdvanceDays >= 1 && (
          <p className="text-sm text-accent">
            Customers can book up to {maxAdvanceDays} day{maxAdvanceDays === 1 ? "" : "s"} ahead —
            dates beyond that won't show as bookable in the calendar.
          </p>
        )}
      </div>

      <SlotAvailability />

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarOff className="h-4 w-4" /> Holidays
        </h3>
        <p className="text-sm text-muted-foreground">
          Closes the entire day for booking — no need to enter business hours, just the date.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              min={todayISODate()}
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className={`border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${holidayDateError ? "border-destructive" : "border-border"}`}
            />
            {holidayDateError && <p className="text-sm text-destructive">{holidayDateError}</p>}
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="block text-sm font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. New Year's Day"
              value={newHolidayReason}
              onChange={(e) => setNewHolidayReason(e.target.value)}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={addHoliday}
            disabled={addingHoliday || !isHolidayDateValid}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {addingHoliday ? "Adding..." : "Add Holiday"}
          </button>
        </div>

        {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
        <div className="hidden lg:block overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.block_id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-foreground">{h.date}</td>
                  <td className="py-2 px-2 text-muted-foreground">{h.reason ?? "—"}</td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => removeBlockedTime(h)}
                      title="Delete"
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    No holidays configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
        <div className="lg:hidden space-y-3">
          {holidays.map((h) => (
            <DataCard key={h.block_id}>
              <p className="font-semibold text-foreground">{h.date}</p>
              <DataCardField label="Reason" value={h.reason ?? "—"} />
              <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                <button
                  onClick={() => removeBlockedTime(h)}
                  title="Delete"
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </DataCard>
          ))}
          {holidays.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No holidays configured
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Blocked / Unavailable Times</h3>
        <p className="text-sm text-muted-foreground">
          For partial-day closures, like a daily lunch break or a maintenance window. Leave date
          blank for a recurring block that applies every working day. For full-day closures, use
          Holidays above instead.
        </p>

        {editingBlockId && (
          <p className="text-sm text-accent flex items-center gap-2">
            Editing block —{" "}
            <button type="button" onClick={resetBlockForm} className="underline hover:no-underline">
              cancel
            </button>
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">
              Date (optional)
            </label>
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">Start</label>
            <input
              type="time"
              value={newBlockStart}
              onChange={(e) => setNewBlockStart(e.target.value)}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">End</label>
            <input
              type="time"
              value={newBlockEnd}
              onChange={(e) => setNewBlockEnd(e.target.value)}
              className={`border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${blockTimeError ? "border-destructive" : "border-border"}`}
            />
            {blockTimeError && <p className="text-sm text-destructive">{blockTimeError}</p>}
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="block text-sm font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Lunch break"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={saveBlockedTime}
            disabled={addingBlock || !isBlockTimeValid}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />{" "}
            {addingBlock
              ? editingBlockId
                ? "Updating..."
                : "Adding..."
              : editingBlockId
                ? "Update Block"
                : "Add Block"}
          </button>
        </div>

        {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
        <div className="hidden lg:block overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Scope</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Start</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">End</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partialBlocks.map((b) => (
                <tr key={b.block_id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-foreground">
                    {b.date ? (
                      <span>{b.date}</span>
                    ) : (
                      <span className="text-accent font-semibold">Every day</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-foreground">{toHHMM(b.start_time)}</td>
                  <td className="py-2 px-2 text-foreground">{toHHMM(b.end_time)}</td>
                  <td className="py-2 px-2 text-muted-foreground">{b.reason ?? "—"}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditBlock(b)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeBlockedTime(b)}
                        title="Delete"
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {partialBlocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No blocked times configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
        <div className="lg:hidden space-y-3">
          {partialBlocks.map((b) => (
            <DataCard key={b.block_id}>
              <div>
                <p className="font-semibold text-foreground">
                  {b.date ? b.date : <span className="text-accent">Every day</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {toHHMM(b.start_time)} – {toHHMM(b.end_time)}
                </p>
              </div>
              <DataCardField label="Reason" value={b.reason ?? "—"} />
              <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                <button
                  onClick={() => startEditBlock(b)}
                  title="Edit"
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => removeBlockedTime(b)}
                  title="Delete"
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </DataCard>
          ))}
          {partialBlocks.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No blocked times configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
