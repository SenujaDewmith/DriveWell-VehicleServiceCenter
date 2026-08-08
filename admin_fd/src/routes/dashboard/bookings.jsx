import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge, PaymentBadge } from "@/components/manager/ManagerOverview";
import { InvoiceViewModal } from "@/components/invoices/InvoiceView";
import { BookingDetailModal } from "@/components/bookings/BookingDetailModal";
import { RescheduleBookingModal } from "@/components/bookings/RescheduleBookingModal";
import { Eye, FileText, X, AlertTriangle, CalendarClock, CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import { DataCard, DataCardField } from "@/components/ui/data-card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const statuses = [
  "Booked",
  "Started",
  "Completed",
  "Collected",
  "Cancelled",
  "No-show",
];

const SORT_OPTIONS = [
  { value: "latest", label: "Date: Latest First" },
  { value: "earliest", label: "Date: Earliest First" },
];

// service_date ("YYYY-MM-DD") and slot_time ("HH:MM:SS") are both zero-padded and already in
// sortable order as plain strings, so a lexical comparison on the combined key is correct
// without parsing into Date objects. Mirrors customer_fd/src/pages/Bookings.jsx's sort.
function sortByServiceDate(list, order) {
  const sorted = [...list].sort((a, b) => {
    const keyA = `${a.service_date}T${a.slot_time || "00:00:00"}`;
    const keyB = `${b.service_date}T${b.slot_time || "00:00:00"}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return order === "latest" ? sorted.reverse() : sorted;
}

// service_date is business-local (see getLocalNow() on the backend); build "today" the same
// way rather than toISOString(), which is UTC and can land on the wrong day near midnight.
function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateShort(date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

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

// Shared between the desktop table's Actions column and the mobile/tablet card
// list's action row, so the confirmation copy only lives in one place.
function NoShowAlertDialog({ booking, marking, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={marking}
          className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
        >
          {marking ? "Marking..." : "Mark No-show"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mark {booking.booking_ref ?? `#${booking.reservation_id}`} as No-show?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This frees up the slot and emails {booking.customer_name} that they missed their
            appointment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Mark No-show</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelBookingAlertDialog({ booking, cancelling, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={cancelling}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Cancel"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {booking.booking_ref ?? `#${booking.reservation_id}`}?</AlertDialogTitle>
          <AlertDialogDescription>
            This cancels the booking and emails {booking.customer_name} — use this when a customer
            calls in to cancel, including inside the 24-hour self-cancel window customers are
            normally held to.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel Booking</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BookingsPage() {
  const { role } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");
  // Date object (local, no time component) or null when no date filter is active.
  const [dateFilter, setDateFilter] = useState(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Keyed by reservation_id so each row can look up its own invoice (if any)
  // without a separate fetch per row.
  const [invoicesByReservation, setInvoicesByReservation] = useState({});
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewDetailsId, setViewDetailsId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

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

  // Manager-only: the backend exempts the Manager role from the 24-hour self-cancel
  // cutoff (see CANCELLATION_CUTOFF_MINUTES in bookings.controller.js), so this is for
  // the "customer called and asked to cancel" case regardless of how close the
  // appointment is.
  const cancelBooking = async (reservationId) => {
    setActionError("");
    setCancellingId(reservationId);
    try {
      await api.patch(`/api/bookings/${reservationId}/cancel`);
      setBookings((prev) =>
        prev.map((b) => (b.reservation_id === reservationId ? { ...b, status: "Cancelled" } : b)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const loadBookings = () => {
    api
      .get("/api/bookings")
      .then((d) => setBookings(d.bookings))
      .catch(() => setError("Failed to load bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();

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

  const today = getLocalDateString();
  const dateFilterStr = dateFilter ? getLocalDateString(dateFilter) : null;
  const isTodaySelected = dateFilterStr === today;

  const filtered = bookings.filter((b) => {
    if (statusFilter !== "All" && b.status !== statusFilter) return false;
    if (dateFilterStr && b.service_date !== dateFilterStr) return false;
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
  const sorted = sortByServiceDate(filtered, sortOrder);

  // Counts reflect the status filter only (not the search box or date filter) — so
  // switching status tabs shows how many bookings are in each, independent of the rest.
  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = bookings.filter((b) => b.status === s).length;
    return acc;
  }, {});
  const todayCount = bookings.filter((b) => b.service_date === today).length;

  const hasFilter = statusFilter !== "All" || search !== "" || Boolean(dateFilterStr);
  const clearFilter = () => {
    setStatusFilter("All");
    setSearch("");
    setDateFilter(null);
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
          className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-64"
        />
        <button
          onClick={() => setDateFilter(isTodaySelected ? null : new Date())}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
            isTodaySelected
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Today ({todayCount})
        </button>
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
                dateFilterStr && !isTodaySelected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFilter ? formatDateShort(dateFilter) : "Pick a date"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter ?? undefined}
              onSelect={(d) => {
                setDateFilter(d ?? null);
                setDatePopoverOpen(false);
              }}
              autoFocus
            />
            {dateFilter && (
              <div className="border-t border-border p-2">
                <button
                  onClick={() => {
                    setDateFilter(null);
                    setDatePopoverOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" /> Clear date
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
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
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <button
            onClick={clearFilter}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear Filter
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>
      {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
      <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Details</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => {
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
                    <td className="py-2 px-3 text-foreground">{b.customer_phone ?? "—"}</td>
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
                      <PaymentBadge paymentStatus={invoice?.payment_status} />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => setViewDetailsId(b.reservation_id)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <FileText className="h-3 w-3" /> Details
                      </button>
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
                      <div className="flex items-center gap-1.5">
                        {isOverdue && (
                          <NoShowAlertDialog
                            booking={b}
                            marking={markingId === b.reservation_id}
                            onConfirm={() => markNoShow(b.reservation_id)}
                          />
                        )}
                        {role === "manager" && b.status === "Booked" && (
                          <button
                            onClick={() => setRescheduleBooking(b)}
                            className="flex items-center gap-1 rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                          >
                            <CalendarClock className="h-3 w-3" /> Reschedule
                          </button>
                        )}
                        {role === "manager" && b.status === "Booked" && (
                          <CancelBookingAlertDialog
                            booking={b}
                            cancelling={cancellingId === b.reservation_id}
                            onConfirm={() => cancelBooking(b.reservation_id)}
                          />
                        )}
                        {!isOverdue && !(role === "manager" && b.status === "Booked") && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-muted-foreground">
                    No bookings match filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
      <div className="lg:hidden space-y-3">
        {sorted.map((b) => {
          const invoice = invoicesByReservation[b.reservation_id];
          const isOverdue =
            b.status === "Booked" && minutesSinceStart(b) >= NO_SHOW_GRACE_MINUTES;
          return (
            <DataCard key={b.reservation_id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {b.booking_ref ?? `#${b.reservation_id}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.service_date} {b.slot_time ? `— ${b.slot_time.slice(0, 5)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
              </div>

              <DataCardField
                label="Customer"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    {b.customer_name}
                    {b.customer_no_show_count > 0 && (
                      <span
                        title={`${b.customer_no_show_count} previous no-show${b.customer_no_show_count > 1 ? "s" : ""}`}
                        className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive"
                      >
                        <AlertTriangle className="h-3 w-3" /> {b.customer_no_show_count}
                      </span>
                    )}
                  </span>
                }
              />
              <DataCardField label="Phone" value={b.customer_phone} />
              <DataCardField label="Vehicle" value={b.plate_no} />
              <DataCardField label="Package" value={b.package_name} />
              <DataCardField
                label="Payment"
                value={<PaymentBadge paymentStatus={invoice?.payment_status} />}
              />

              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border">
                <button
                  onClick={() => setViewDetailsId(b.reservation_id)}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <FileText className="h-3 w-3" /> Details
                </button>
                {invoice && (
                  <button
                    onClick={() => setViewInvoice(invoice)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3 w-3" /> Invoice
                  </button>
                )}
                {isOverdue && (
                  <NoShowAlertDialog
                    booking={b}
                    marking={markingId === b.reservation_id}
                    onConfirm={() => markNoShow(b.reservation_id)}
                  />
                )}
                {role === "manager" && b.status === "Booked" && (
                  <button
                    onClick={() => setRescheduleBooking(b)}
                    className="flex items-center gap-1 rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                  >
                    <CalendarClock className="h-3 w-3" /> Reschedule
                  </button>
                )}
                {role === "manager" && b.status === "Booked" && (
                  <CancelBookingAlertDialog
                    booking={b}
                    cancelling={cancellingId === b.reservation_id}
                    onConfirm={() => cancelBooking(b.reservation_id)}
                  />
                )}
              </div>
            </DataCard>
          );
        })}
        {sorted.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No bookings match filter
          </div>
        )}
      </div>
        </>
      )}

      {viewInvoice && (
        <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}

      {viewDetailsId && (
        <BookingDetailModal
          reservationId={viewDetailsId}
          invoice={invoicesByReservation[viewDetailsId]}
          onClose={() => setViewDetailsId(null)}
          onViewInvoice={(inv) => {
            setViewDetailsId(null);
            setViewInvoice(inv);
          }}
        />
      )}

      {rescheduleBooking && (
        <RescheduleBookingModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onRescheduled={() => {
            setRescheduleBooking(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
