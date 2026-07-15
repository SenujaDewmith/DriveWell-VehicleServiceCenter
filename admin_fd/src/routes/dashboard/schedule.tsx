import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
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
  capacity: number;
  is_active: boolean;
}

interface ApiConfig {
  config_id: number;
  working_days: string;
}

function SchedulePage() {
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [slotCapacities, setSlotCapacities] = useState<Record<number, string>>({});
  const [newSlotTime, setNewSlotTime] = useState("");
  const [newSlotCapacity, setNewSlotCapacity] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);
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
        setSlots(s);
        const capMap: Record<number, string> = {};
        s.forEach((slot) => { capMap[slot.slot_id] = String(slot.capacity); });
        setSlotCapacities(capMap);
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

  const saveWorkingDays = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const working_days = workingDays
        .map((d) => DAY_TO_NUM[d])
        .sort((a, b) => a - b)
        .join(",");
      await api.put("/api/config", { working_days });
      setSuccess("Working days saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addSlot = async () => {
    if (!newSlotTime) return;
    const capacity = Number(newSlotCapacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a positive whole number");
      return;
    }
    setError("");
    try {
      await api.post("/api/config/slots", { slot_time: newSlotTime, capacity });
      setNewSlotTime("");
      setNewSlotCapacity("5");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add slot");
    }
  };

  const saveSlotCapacity = async (slot: ApiSlot) => {
    const capacity = Number(slotCapacities[slot.slot_id]);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a positive whole number");
      return;
    }
    setSavingSlotId(slot.slot_id);
    setError("");
    try {
      await api.patch(`/api/config/slots/${slot.slot_id}`, { capacity });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update capacity");
    } finally {
      setSavingSlotId(null);
    }
  };

  const toggleActive = async (slot: ApiSlot) => {
    setError("");
    try {
      await api.patch(`/api/config/slots/${slot.slot_id}`, { is_active: !slot.is_active });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update slot");
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
      <h1 className="text-2xl font-extrabold tracking-tighter">SCHEDULE CONFIG</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs font-mono text-accent border border-accent px-3 py-2">{success}</p>
      )}

      <div className="border-2 border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Working Days</h3>
          <button
            onClick={saveWorkingDays}
            disabled={saving}
            className="border-2 border-accent bg-accent px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Working Days"}
          </button>
        </div>
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
      </div>

      <div className="border-2 border-border bg-card p-4 space-y-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground">Time Slots &amp; Capacity</h3>
        <p className="text-[10px] font-mono text-muted-foreground">
          Each slot's capacity controls how many bookings customers can make at that specific time.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Time</label>
            <input
              type="time"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-muted-foreground">Capacity</label>
            <input
              type="number"
              min={1}
              value={newSlotCapacity}
              onChange={(e) => setNewSlotCapacity(e.target.value)}
              className="w-20 border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={addSlot}
            className="flex items-center gap-1 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Slot
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Time</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Capacity</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.slot_id} className={`border-b border-border ${!slot.is_active ? "opacity-50" : ""}`}>
                  <td className="py-2 px-2 text-foreground">{slot.slot_time.slice(0, 5)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={slotCapacities[slot.slot_id] ?? ""}
                        onChange={(e) => setSlotCapacities({ ...slotCapacities, [slot.slot_id]: e.target.value })}
                        className="w-16 border-2 border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                      <button
                        onClick={() => saveSlotCapacity(slot)}
                        disabled={
                          savingSlotId === slot.slot_id ||
                          slotCapacities[slot.slot_id] === String(slot.capacity)
                        }
                        className="border-2 border-accent bg-accent px-2 py-1 text-[10px] font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {savingSlotId === slot.slot_id ? "..." : "Save"}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`text-[10px] uppercase font-bold ${slot.is_active ? "text-accent" : "text-muted-foreground"}`}
                    >
                      {slot.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleActive(slot)}
                        title={slot.is_active ? "Deactivate" : "Activate"}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {slot.is_active ? (
                          <ToggleRight className="h-3 w-3 text-accent" />
                        ) : (
                          <ToggleLeft className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => removeSlot(slot)}
                        title="Delete"
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slots.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No time slots configured
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
