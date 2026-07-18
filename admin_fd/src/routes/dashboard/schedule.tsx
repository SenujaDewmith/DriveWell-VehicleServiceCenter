import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/schedule")({
  component: SchedulePage,
});

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_TO_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};
const NUM_TO_DAY: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};

interface ApiConfig {
  config_id: number;
  working_days: string;
  day_start_time: string;
  day_end_time: string;
  same_day_cutoff_minutes: number;
}

function subtractMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m - minutes;
  total = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmt12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

interface ApiBlockedTime {
  block_id: number;
  date: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
}

function toHHMM(t: string) {
  return t.slice(0, 5);
}

// A holiday is a blocked time that spans the entire day for a specific date
function isHoliday(b: ApiBlockedTime) {
  return b.date !== null && toHHMM(b.start_time) === "00:00" && toHHMM(b.end_time) === "23:59";
}

function SchedulePage() {
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [cutoffHours, setCutoffHours] = useState(4);
  const [blockedTimes, setBlockedTimes] = useState<ApiBlockedTime[]>([]);

  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockStart, setNewBlockStart] = useState("");
  const [newBlockEnd, setNewBlockEnd] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

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
      .get<{ config: ApiConfig; blocked_times: ApiBlockedTime[] }>("/api/config")
      .then(({ config, blocked_times }) => {
        const days = config.working_days
          .split(",")
          .map((n) => NUM_TO_DAY[parseInt(n)])
          .filter(Boolean);
        setWorkingDays(days);
        setDayStart(toHHMM(config.day_start_time));
        setDayEnd(toHHMM(config.day_end_time));
        setCutoffHours(config.same_day_cutoff_minutes / 60);
        setBlockedTimes(blocked_times);
      })
      .catch(() => setError("Failed to load config"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
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
      });
      setSuccess("Business hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addBlockedTime = async () => {
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
      await api.post("/api/config/blocked-times", {
        date: newBlockDate || undefined,
        start_time: newBlockStart,
        end_time: newBlockEnd,
        reason: newBlockReason || undefined,
      });
      setNewBlockDate("");
      setNewBlockStart("");
      setNewBlockEnd("");
      setNewBlockReason("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add blocked time");
    } finally {
      setAddingBlock(false);
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate) {
      setError("Date is required");
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

  const removeBlockedTime = async (block: ApiBlockedTime) => {
    setError("");
    try {
      await api.delete(`/api/config/blocked-times/${block.block_id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove blocked time");
    }
  };

  const holidays = blockedTimes
    .filter(isHoliday)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const partialBlocks = blockedTimes.filter((b) => !isHoliday(b));

  if (loading) {
    return <div className="text-sm text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Schedule Config</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-accent border border-accent/30 bg-accent/5 rounded-md px-3 py-2">{success}</p>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Business Hours</h3>
          <button
            onClick={saveBusinessHours}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Business Hours"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Appointment windows are generated automatically for each service package based on its duration and
          these hours — you no longer need to create individual time slots.
        </p>

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
            <label className="block text-sm font-medium text-muted-foreground">Same-Day Cutoff (hours before closing)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={cutoffHours}
              onChange={(e) => setCutoffHours(Number(e.target.value))}
              className="w-40 border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {dayEnd && cutoffHours >= 0 && (
          <p className="text-sm text-accent">
            Same-day bookings will close at {fmt12h(subtractMinutes(dayEnd, Math.round(cutoffHours * 60)))} — after that, today becomes unavailable in the booking calendar.
          </p>
        )}
      </div>

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
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="block text-sm font-medium text-muted-foreground">Reason (optional)</label>
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
            disabled={addingHoliday}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {addingHoliday ? "Adding..." : "Add Holiday"}
          </button>
        </div>

        <div className="overflow-x-auto">
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
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Blocked / Unavailable Times</h3>
        <p className="text-sm text-muted-foreground">
          For partial-day closures, like a daily lunch break or a maintenance window. Leave date blank for a
          recurring block that applies every working day. For full-day closures, use Holidays above instead.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted-foreground">Date (optional)</label>
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
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="block text-sm font-medium text-muted-foreground">Reason (optional)</label>
            <input
              type="text"
              placeholder="e.g. Lunch break"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={addBlockedTime}
            disabled={addingBlock}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {addingBlock ? "Adding..." : "Add Block"}
          </button>
        </div>

        <div className="overflow-x-auto">
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
                    <button
                      onClick={() => removeBlockedTime(b)}
                      title="Delete"
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
      </div>
    </div>
  );
}
