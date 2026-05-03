import { useState } from "react";
import { getStaffBookings, bookings, type Booking } from "@/data/dummyData";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Star } from "lucide-react";

// Staff member S004 = Ruwan Silva (logged in staff)
const STAFF_ID = "S004";
const STAFF_NAME = "Ruwan Silva";

export function StaffDashboard() {
  const [period, setPeriod] = useState<"today" | "week" | "all">("all");
  const myBookings = getStaffBookings(STAFF_ID);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const filtered = myBookings.filter((b) => {
    if (period === "today") return b.date === today;
    if (period === "week") return b.date >= weekAgo;
    return true;
  });

  const completed = filtered.filter((b) => b.status === "Billed" || b.status === "Completed" || b.status === "Ready for Pickup").length;
  const rated = filtered.filter((b) => b.rating !== undefined);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length).toFixed(1)
    : "N/A";

  const performanceData = [
    { metric: "Completed", value: completed },
    { metric: "In Progress", value: filtered.filter((b) => b.status === "In Progress" || b.status === "Started").length },
    { metric: "Booked", value: filtered.filter((b) => b.status === "Booked").length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter">MY DASHBOARD</h1>
          <p className="text-xs font-mono text-muted-foreground uppercase">{STAFF_NAME} // {STAFF_ID}</p>
        </div>
        <div className="flex gap-1">
          {(["today", "week", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`border-2 px-3 py-1.5 text-[10px] font-mono uppercase font-bold transition-colors ${
                period === p
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {p === "all" ? "All Time" : p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Jobs</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">{filtered.length}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Completed</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">{completed}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-extrabold text-foreground">{avgRating}</p>
            {avgRating !== "N/A" && <Star className="h-5 w-5 text-accent fill-accent" />}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="border-2 border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Performance Summary</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
            <Bar dataKey="value" fill="#A7D129" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* My Jobs */}
      <div className="border-2 border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">My Jobs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">ID</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Date</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Package</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 uppercase text-muted-foreground">Rating</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border">
                  <td className="py-2 px-2 text-muted-foreground">{b.id}</td>
                  <td className="py-2 px-2 text-foreground">{b.date}</td>
                  <td className="py-2 px-2 text-foreground">{b.customerName}</td>
                  <td className="py-2 px-2 text-foreground">{b.vehicle.plate}</td>
                  <td className="py-2 px-2 text-foreground">{b.package}</td>
                  <td className="py-2 px-2"><StatusBadge status={b.status} /></td>
                  <td className="py-2 px-2">
                    {b.rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-accent fill-accent" />
                        <span>{b.rating}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
