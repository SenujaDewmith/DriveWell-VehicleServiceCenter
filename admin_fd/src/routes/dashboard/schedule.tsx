import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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

interface ApiSlot {
  slot_id: number;
  slot_time: string;
  is_active: boolean;
}

interface ApiConfig {
  config_id: number;
  daily_capacity: number;
  working_days: string;
}

function SchedulePage() {
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(10);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [newSlot, setNewSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ config: ApiConfig; slots: ApiSlot[] }>("/api/config")
      .then(({ config, slots: s }) => {
        const days = config.working_days
          .split(",")
          .map((n) => NUM_TO_DAY[parseInt(n)])
          .filter(Boolean);
        setWorkingDays(days);
        setCapacity(config.daily_capacity);
        setSlots(s);
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

  const saveConfig = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const working_days = workingDays
        .map((d) => DAY_TO_NUM[d])
        .sort((a, b) => a - b)
        .join(",");
      await api.put("/api/config", { daily_capacity: capacity, working_days });
      setSuccess("Configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addSlot = async () => {
    if (!newSlot) return;
    setError("");
    try {
      await api.post("/api/config/slots", { slot_time: newSlot });
      setNewSlot("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add slot");
    }
  };

  const removeSlot = async (slot: ApiSlot) => {
    setError("");
    try {
      await api.delete(`/api/config/slots/${slot.slot_id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove slot");
    }
  };

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tighter">SCHEDULE CONFIG</h1>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="border-2 border-accent bg-accent px-4 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs font-mono text-accent border border-accent px-3 py-2">{success}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-2 border-border bg-card p-4 space-y-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Working Days</h3>
          <div className="grid grid-cols-2 gap-2">
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
        </div>

        <div className="border-2 border-border bg-card p-4 space-y-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Daily Capacity</h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-24 border-2 border-border bg-background px-3 py-2 text-sm font-mono text-foreground text-center focus:outline-none focus:border-accent"
            />
            <span className="text-xs font-mono text-muted-foreground">vehicles per day</span>
          </div>
        </div>
      </div>

      <div className="border-2 border-border bg-card p-4 space-y-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground">Time Slots</h3>
        <div className="flex gap-2">
          <input
            type="time"
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
          />
          <button
            onClick={addSlot}
            className="border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
          >
            Add Slot
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot.slot_id}
              onClick={() => removeSlot(slot)}
              className={`border px-3 py-1.5 text-xs font-mono transition-colors group ${
                slot.is_active
                  ? "border-border text-foreground hover:border-destructive hover:text-destructive"
                  : "border-border text-muted-foreground opacity-50"
              }`}
            >
              {slot.slot_time.slice(0, 5)}{" "}
              <span className="text-muted-foreground group-hover:text-destructive">×</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
