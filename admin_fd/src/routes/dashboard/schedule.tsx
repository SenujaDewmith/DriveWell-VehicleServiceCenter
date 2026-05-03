import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { scheduleConfig } from "@/data/dummyData";

export const Route = createFileRoute("/dashboard/schedule")({
  component: SchedulePage,
});

const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function SchedulePage() {
  const [config, setConfig] = useState(scheduleConfig);
  const [newSlot, setNewSlot] = useState("");

  const toggleDay = (day: string) => {
    setConfig((c) => ({
      ...c,
      workingDays: c.workingDays.includes(day)
        ? c.workingDays.filter((d) => d !== day)
        : [...c.workingDays, day],
    }));
  };

  const addSlot = () => {
    if (newSlot && !config.timeSlots.includes(newSlot)) {
      setConfig((c) => ({ ...c, timeSlots: [...c.timeSlots, newSlot].sort() }));
      setNewSlot("");
    }
  };

  const removeSlot = (slot: string) => {
    setConfig((c) => ({ ...c, timeSlots: c.timeSlots.filter((s) => s !== slot) }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">SCHEDULE CONFIG</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-2 border-border bg-card p-4 space-y-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Working Days</h3>
          <div className="grid grid-cols-2 gap-2">
            {allDays.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`border-2 px-3 py-2 text-xs font-mono uppercase font-bold transition-colors ${
                  config.workingDays.includes(day)
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
          <h3 className="text-xs font-mono uppercase text-muted-foreground">Capacity per Slot</h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={config.capacityPerSlot}
              onChange={(e) => setConfig((c) => ({ ...c, capacityPerSlot: Number(e.target.value) }))}
              className="w-24 border-2 border-border bg-background px-3 py-2 text-sm font-mono text-foreground text-center focus:outline-none focus:border-accent"
            />
            <span className="text-xs font-mono text-muted-foreground">vehicles per time slot</span>
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
          <button onClick={addSlot} className="border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90">
            Add Slot
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.timeSlots.map((slot) => (
            <button
              key={slot}
              onClick={() => removeSlot(slot)}
              className="border border-border px-3 py-1.5 text-xs font-mono text-foreground hover:border-destructive hover:text-destructive transition-colors group"
            >
              {slot} <span className="text-muted-foreground group-hover:text-destructive">×</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
