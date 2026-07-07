import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";

type BookingStatus =
  | "Booked"
  | "Started"
  | "In Progress"
  | "Completed"
  | "Ready for Pickup"
  | "Cancelled"
  | "No-show";

interface ApiBooking {
  reservation_id: number;
  booking_ref: string | null;
  service_date: string;
  status: BookingStatus;
  customer_name: string;
  plate_no: string;
  package_name: string;
  slot_time: string | null;
}

export const Route = createFileRoute("/dashboard/bookings")({
  component: BookingsPage,
});

const statuses: BookingStatus[] = [
  "Booked",
  "Started",
  "In Progress",
  "Completed",
  "Ready for Pickup",
  "Cancelled",
  "No-show",
];

function BookingsPage() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "All">("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<{ bookings: ApiBooking[] }>("/api/bookings")
      .then((d) => setBookings(d.bookings))
      .catch(() => setError("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    if (statusFilter !== "All" && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.plate_no.toLowerCase().includes(q) ||
        (b.booking_ref ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">ALL BOOKINGS</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search customer, plate, ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent w-64"
        />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter("All")}
            className={`border-2 px-2 py-1.5 text-[10px] font-mono uppercase font-bold transition-colors ${
              statusFilter === "All"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`border-2 px-2 py-1.5 text-[10px] font-mono uppercase font-bold transition-colors ${
                statusFilter === s
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="border-2 border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Ref</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Time</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Vehicle</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Package</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.reservation_id} className="border-b border-border">
                  <td className="py-2 px-3 text-muted-foreground">
                    {b.booking_ref ?? `#${b.reservation_id}`}
                  </td>
                  <td className="py-2 px-3 text-foreground">{b.service_date}</td>
                  <td className="py-2 px-3 text-foreground">
                    {b.slot_time ? b.slot_time.slice(0, 5) : "—"}
                  </td>
                  <td className="py-2 px-3 text-foreground">{b.customer_name}</td>
                  <td className="py-2 px-3 text-foreground">{b.plate_no}</td>
                  <td className="py-2 px-3 text-foreground">{b.package_name}</td>
                  <td className="py-2 px-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No bookings match filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
