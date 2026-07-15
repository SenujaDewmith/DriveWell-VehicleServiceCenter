import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
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

function SchedulePage() {
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [dayStart, setDayStart] = useState("");
  const [dayEnd, setDayEnd] = useState("");
  const [blockedTimes, setBlockedTimes] = useState<ApiBlockedTime[]>([]);

  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockStart, setNewBlockStart] = useState("");
  const [newBlockEnd, setNewBlockEnd] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
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
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const working_days = workingDays
        .map((d) => DAY_TO_NUM[d])
        .sort((a, b) => a - b)
        .join(",");
      await api.put("/api/config", { working_days, day_start_time: dayStart, day_end_time: dayEnd });
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

  const removeBlockedTime = async (block: ApiBlockedTime) => {
    setError("");
    try {
      await api.delete(`/api/config/blocked-times/${block.block_id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove blocked time");
    }
  };

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">SCHEDULE CONFIG</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs font-mono text-accent border border-accent px-3 py-2">{success}</p>
      )}

      <div className="border-2 border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Business Hours</h3>
          <button
            onClick={saveBusinessHours}
            disabled={saving}
            className="border-2 border-accent bg-accent px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Business Hours"}
          </button>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground">
          Appointment windows are generated automatically for each service package based on its duration and
          these hours — you no longer need to create individual time slots.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`border-2 px-3 py-2 text-xs font-mono uppercase font-bold transition-colors ${
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
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Day Start</label>
            <input
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Day End</label>
            <input
              type="time"
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      <div className="border-2 border-border bg-card p-4 space-y-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground">Blocked / Unavailable Times</h3>
        <p className="text-[10px] font-mono text-muted-foreground">
          Leave date blank for a recurring block that applies every working day (e.g. lunch break). Set a date
          for a one-off closure (e.g. a specific holiday or maintenance window).
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Date (optional)</label>
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Start</label>
            <input
              type="time"
              value={newBlockStart}
              onChange={(e) => setNewBlockStart(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">End</label>
            <input
              type="time"
              value={newBlockEnd}
              onChange={(e) => setNewBlockEnd(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Reason (optional)</label>
            <input
              type="text"
              placeholder="e.g. Lunch break"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="w-full border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={addBlockedTime}
            disabled={addingBlock}
            className="flex items-center gap-1 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {addingBlock ? "Adding..." : "Add Block"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Scope</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Start</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">End</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Reason</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blockedTimes.map((b) => (
                <tr key={b.block_id} className="border-b border-border">
                  <td className="py-2 px-2 text-foreground">
                    {b.date ? (
                      <span>{b.date}</span>
                    ) : (
                      <span className="text-accent font-bold">Every day</span>
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
              {blockedTimes.length === 0 && (
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
