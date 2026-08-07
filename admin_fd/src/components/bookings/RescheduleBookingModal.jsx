import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Staff-side equivalent of customer_fd's Reschedule flow (BookService.jsx, ?fromBooking=
// on a Booked booking) — only ever offered for a still-live Booked booking (see bookings.jsx),
// moving it to a new date/time in place via PATCH .../reschedule (same reservation_id and
// booking_ref, not a new row — that's what separates this from "Book Again", which admin_fd
// deliberately does not offer: rebooking a Cancelled/Collected booking is customer
// self-service only). Vehicle and package are fixed to the original booking and never
// re-picked here — this modal only ever changes date/time.
export function RescheduleBookingModal({ booking, onClose, onRescheduled }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsMessage("");
    setSelectedSlot(null);
    api
      .get(
        `/api/bookings/available-slots?date=${date}&package_id=${booking.package_id}&vehicle_id=${booking.vehicle_id}&exclude_reservation_id=${booking.reservation_id}`,
      )
      .then((d) => {
        if (cancelled) return;
        setSlots(d.slots);
        if (!d.available) setSlotsMessage(d.reason ?? "No availability on this date");
      })
      .catch(() => {
        if (!cancelled) setSlotsMessage("Failed to check availability");
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, booking.package_id, booking.vehicle_id, booking.reservation_id]);

  const handleConfirm = async () => {
    if (!date || !selectedSlot) return;
    setSubmitting(true);
    setError("");
    try {
      await api.patch(`/api/bookings/${booking.reservation_id}/reschedule`, {
        vehicle_id: booking.vehicle_id,
        package_id: booking.package_id,
        service_date: date,
        start_time: selectedSlot.start_time,
      });
      onRescheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-3 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">
            Reschedule {booking.booking_ref ?? `#${booking.reservation_id}`}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 space-y-4">
          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <p className="text-foreground font-medium">
              {booking.customer_name} — {[booking.make, booking.model].filter(Boolean).join(" ")} ({booking.plate_no})
            </p>
            <p className="text-muted-foreground">{booking.package_name}</p>
            <p className="text-muted-foreground">
              Currently: {booking.service_date}
              {booking.slot_time ? ` at ${booking.slot_time.slice(0, 5)}` : ""}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">New Date</label>
            <input
              type="date"
              min={todayKey()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {date && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">New Time Slot</label>
              {slotsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{slotsMessage || "No slots for this date"}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start_time === slot.start_time;
                    const isDisabled = slot.remaining <= 0 || slot.vehicle_conflict;
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedSlot(slot)}
                        className={`text-left border rounded-md px-2.5 py-2 text-sm transition-colors ${
                          isSelected
                            ? "border-accent bg-accent/10 text-foreground"
                            : isDisabled
                              ? "opacity-50 cursor-not-allowed border-border text-muted-foreground"
                              : "border-border text-foreground hover:border-accent/50"
                        }`}
                      >
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        {slot.vehicle_conflict && (
                          <span className="block text-xs text-destructive">Vehicle already booked</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-3 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!date || !selectedSlot || submitting}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Rescheduling..." : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
