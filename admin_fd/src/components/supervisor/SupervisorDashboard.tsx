import { useState } from "react";
import { getTodayBookings, staff, type Booking, type BookingStatus } from "@/data/dummyData";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { CheckCircle, ChevronRight, User, X } from "lucide-react";

const statusFlow: BookingStatus[] = ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup"];
const taskTypes = ["Interior Wash", "Under Wash", "Body Wash"];
const serviceStaff = staff.filter((s) => s.role === "staff" && s.active);

export function SupervisorDashboard() {
  const [bookingsState, setBookingsState] = useState(getTodayBookings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookingsState.find((b) => b.id === selectedId);

  const advanceStatus = (id: string) => {
    setBookingsState((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const idx = statusFlow.indexOf(b.status);
        if (idx < 0 || idx >= statusFlow.length - 1) return b;
        return { ...b, status: statusFlow[idx + 1] };
      })
    );
  };

  const toggleQuality = (id: string) => {
    setBookingsState((prev) =>
      prev.map((b) => (b.id === id ? { ...b, qualityChecked: !b.qualityChecked } : b))
    );
  };

  const updateRemarks = (id: string, remarks: string) => {
    setBookingsState((prev) =>
      prev.map((b) => (b.id === id ? { ...b, remarks } : b))
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">TODAY'S RESERVATIONS</h1>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Cards list */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bookingsState
            .filter((b) => b.status !== "Billed")
            .map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`text-left border-2 p-4 transition-colors ${
                  selectedId === b.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-muted-foreground"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{b.id} // {b.timeSlot}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm font-bold text-foreground">{b.customerName}</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {b.vehicle.plate} — {b.vehicle.make} {b.vehicle.model}
                </p>
                <p className="text-xs font-mono text-accent mt-1">{b.package}</p>
                {b.qualityChecked && (
                  <div className="flex items-center gap-1 mt-2 text-chart-1">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-[10px] font-mono uppercase">QC Passed</span>
                  </div>
                )}
              </button>
            ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full lg:w-96 border-2 border-border bg-card p-4 space-y-4 h-fit">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold uppercase">{selected.id} — Detail</h3>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <p><span className="text-muted-foreground">Customer:</span> {selected.customerName}</p>
              <p><span className="text-muted-foreground">Phone:</span> {selected.phone}</p>
              <p><span className="text-muted-foreground">Vehicle:</span> {selected.vehicle.plate} — {selected.vehicle.color} {selected.vehicle.make} {selected.vehicle.model}</p>
              <p><span className="text-muted-foreground">Package:</span> {selected.package}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></p>
            </div>

            {/* Advance status */}
            {statusFlow.indexOf(selected.status) >= 0 &&
              statusFlow.indexOf(selected.status) < statusFlow.length - 1 && (
                <button
                  onClick={() => advanceStatus(selected.id)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-accent bg-accent py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
                >
                  Advance to {statusFlow[statusFlow.indexOf(selected.status) + 1]}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

            {/* Remarks */}
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Remarks</label>
              <textarea
                value={selected.remarks}
                onChange={(e) => updateRemarks(selected.id, e.target.value)}
                className="w-full mt-1 border-2 border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-accent resize-none h-16"
              />
            </div>

            {/* Consumables */}
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Consumables</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selected.consumables.length > 0
                  ? selected.consumables.map((c) => (
                      <span key={c} className="border border-border px-2 py-0.5 text-[10px] font-mono text-foreground">
                        {c}
                      </span>
                    ))
                  : <span className="text-[10px] font-mono text-muted-foreground">None noted</span>}
              </div>
            </div>

            {/* Staff assignment */}
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Assigned Staff</label>
              <div className="space-y-1 mt-1">
                {taskTypes.map((task) => (
                  <div key={task} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground w-24">{task}:</span>
                    <select className="flex-1 border border-border bg-background px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-accent">
                      <option value="">— Unassigned —</option>
                      {serviceStaff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality check */}
            <button
              onClick={() => toggleQuality(selected.id)}
              className={`w-full flex items-center justify-center gap-2 border-2 py-2 text-xs font-mono uppercase font-bold transition-colors ${
                selected.qualityChecked
                  ? "border-chart-1 bg-chart-1/10 text-chart-1"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              {selected.qualityChecked ? "QC Passed ✓" : "Mark Quality Check"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
