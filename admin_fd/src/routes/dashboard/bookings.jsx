import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { InvoiceViewModal } from "@/components/invoices/InvoiceView";
import { Eye, X, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statuses = [
  "Booked",
  "Started",
  "In Progress",
  "Completed",
  "Ready for Pickup",
  "Collected",
  "Cancelled",
  "No-show",
];

// Must match NO_SHOW_GRACE_MINUTES in backend/src/controllers/bookings.controller.js — kept
// in sync so the button is only ever enabled when the backend will actually accept the call.
const NO_SHOW_GRACE_MINUTES = 15;

// service_date + slot_time are business-local (see getLocalNow() on the backend), and this
// parses them the same way — as browser-local time, not UTC — which only lines up correctly
// if staff are in the same timezone as the business. True everywhere else in this admin app.
const minutesSinceStart = (b) => {
  const appointment = new Date(`${b.service_date}T${b.slot_time}`);
  return (Date.now() - appointment.getTime()) / 60000;
};

export function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  // Keyed by reservation_id so each row can look up its own invoice (if any)
  // without a separate fetch per row.
  const [invoicesByReservation, setInvoicesByReservation] = useState({});
  const [viewInvoice, setViewInvoice] = useState(null);
  const [actionError, setActionError] = useState("");
  const [markingId, setMarkingId] = useState(null);

  const markNoShow = async (reservationId) => {
    setActionError("");
    setMarkingId(reservationId);
    try {
      await api.patch(`/api/bookings/${reservationId}/status`, { status: "No-show" });
      setBookings((prev) =>
        prev.map((b) => (b.reservation_id === reservationId ? { ...b, status: "No-show" } : b)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark as No-show");
    } finally {
      setMarkingId(null);
    }
  };

  useEffect(() => {
    api
      .get("/api/bookings")
      .then((d) => setBookings(d.bookings))
      .catch(() => setError("Failed to load bookings"))
      .finally(() => setLoading(false));

    api
      .get("/api/invoices")
      .then((d) => {
        const map = {};
        d.invoices.forEach((inv) => {
          map[inv.reservation_id] = inv;
        });
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
  }, {});

  const hasFilter = statusFilter !== "All" || search !== "";
  const clearFilter = () => {
    setStatusFilter("All");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">All Bookings</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {actionError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {actionError}
        </p>
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const invoice = invoicesByReservation[b.reservation_id];
                const isOverdue =
                  b.status === "Booked" && minutesSinceStart(b) >= NO_SHOW_GRACE_MINUTES;
                return (
                  <tr key={b.reservation_id} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 text-muted-foreground">
                      {b.booking_ref ?? `#${b.reservation_id}`}
                    </td>
                    <td className="py-2 px-3 text-foreground">{b.service_date}</td>
                    <td className="py-2 px-3 text-foreground">
                      {b.slot_time ? b.slot_time.slice(0, 5) : "—"}
                    </td>
                    <td className="py-2 px-3 text-foreground">
                      <div className="flex items-center gap-1.5">
                        {b.customer_name}
                        {b.customer_no_show_count > 0 && (
                          <span
                            title={`${b.customer_no_show_count} previous no-show${b.customer_no_show_count > 1 ? "s" : ""}`}
                            className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive"
                          >
                            <AlertTriangle className="h-3 w-3" /> {b.customer_no_show_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-foreground">{b.plate_no}</td>
                    <td className="py-2 px-3 text-foreground">{b.package_name}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={b.status} />
                        {isOverdue && (
                          <span
                            title="Past its scheduled time and still marked Booked"
                            className="rounded-full bg-status-cancelled/10 px-1.5 py-0.5 text-xs font-medium text-status-cancelled"
                          >
                            Overdue
                          </span>
                        )}
                      </div>
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
                    <td className="py-2 px-3">
                      {isOverdue ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={markingId === b.reservation_id}
                              className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                            >
                              {markingId === b.reservation_id ? "Marking..." : "Mark No-show"}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Mark {b.booking_ref ?? `#${b.reservation_id}`} as No-show?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This frees up the slot and emails {b.customer_name} that they missed
                                their appointment.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => markNoShow(b.reservation_id)}>
                                Mark No-show
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
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
