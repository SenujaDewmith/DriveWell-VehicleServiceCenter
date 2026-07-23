import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { InvoiceViewModal, type InvoiceViewData } from "@/components/invoices/InvoiceView";
import { Eye, X } from "lucide-react";

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

  // Keyed by reservation_id so each row can look up its own invoice (if any)
  // without a separate fetch per row.
  const [invoicesByReservation, setInvoicesByReservation] = useState<Record<number, InvoiceViewData>>({});
  const [viewInvoice, setViewInvoice] = useState<InvoiceViewData | null>(null);

  useEffect(() => {
    api
      .get<{ bookings: ApiBooking[] }>("/api/bookings")
      .then((d) => setBookings(d.bookings))
      .catch(() => setError("Failed to load bookings"))
      .finally(() => setLoading(false));

    api
      .get<{ invoices: (InvoiceViewData & { reservation_id: number })[] }>("/api/invoices")
      .then((d) => {
        const map: Record<number, InvoiceViewData> = {};
        d.invoices.forEach((inv) => { map[inv.reservation_id] = inv; });
        setInvoicesByReservation(map);
      })
      .catch(() => {});
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

  // Counts reflect the status filter only (not the search box) — so switching
  // status tabs shows how many bookings are in each, independent of search text.
  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = bookings.filter((b) => b.status === s).length;
    return acc;
  }, {} as Record<BookingStatus, number>);

  const hasFilter = statusFilter !== "All" || search !== "";
  const clearFilter = () => {
    setStatusFilter("All");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">All Bookings</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search customer, plate, ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-64"
        />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter("All")}
            className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === "All"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            All ({bookings.length})
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s} ({statusCounts[s]})
            </button>
          ))}
        </div>
        {hasFilter && (
          <button
            onClick={clearFilter}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear Filter
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const invoice = invoicesByReservation[b.reservation_id];
                return (
                  <tr key={b.reservation_id} className="border-b border-border last:border-0">
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
                    <td className="py-2 px-3">
                      {invoice ? (
                        <button
                          onClick={() => setViewInvoice(invoice)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No bookings match filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {viewInvoice && (
        <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
    </div>
  );
}
