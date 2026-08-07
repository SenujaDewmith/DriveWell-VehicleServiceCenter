import { useEffect, useState } from "react";
import { X, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge, PaymentBadge } from "@/components/manager/ManagerOverview";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

// Full read-only "everything about this booking" view for Manager/Supervisor — unlike
// InvoiceViewModal (billing only), this surfaces the customer, vehicle, service record,
// and who actually worked on the vehicle, so decisions aren't made off the invoice alone.
//
// `invoice` is the already-loaded invoice object from the parent page's /api/invoices
// map (not re-derived from the booking-detail payload below) — it's the shape
// InvoiceViewModal actually expects (customer_name, plate_no, booking_ref, etc.),
// while GET /api/bookings/:id returns a slimmer billing-only invoice shape.
export function BookingDetailModal({ reservationId, invoice, onClose, onViewInvoice }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/api/bookings/${reservationId}`)
      .then((d) => {
        if (!cancelled) setBooking(d.booking);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load booking");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  const record = booking?.service_record;
  const assignments = record?.assignments ?? [];

  return (
    <div
      className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-3 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">Booking Details</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {error && (
          <p className="m-3 text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {booking && !loading && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {booking.booking_ref ?? `#${booking.reservation_id}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {booking.service_date}{" "}
                  {booking.slot_time ? `— ${booking.slot_time.slice(0, 5)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={booking.status} />
                <PaymentBadge paymentStatus={booking.payment_status} />
              </div>
            </div>

            <Section title="Customer">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <Field label="Name" value={booking.customer_name} />
                <Field label="Phone" value={booking.customer_phone} />
                <Field label="Email" value={booking.customer_email} />
                {booking.customer_no_show_count > 0 && (
                  <Field label="Previous No-shows" value={booking.customer_no_show_count} />
                )}
              </div>
            </Section>

            <Section title="Vehicle & Package">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <Field label="Plate No." value={booking.plate_no} />
                <Field
                  label="Vehicle"
                  value={[booking.make, booking.model].filter(Boolean).join(" ") || "—"}
                />
                <Field label="Package" value={booking.package_name} />
                <Field
                  label="Price"
                  value={
                    booking.package_price != null
                      ? `LKR ${Number(booking.package_price).toLocaleString()}`
                      : null
                  }
                />
              </div>
            </Section>

            {record && (
              <Section title="Service Record">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <Field label="Quality Checked" value={record.quality_checked ? "Yes" : "No"} />
                  <Field
                    label="Started"
                    value={record.started_at ? new Date(record.started_at).toLocaleString() : null}
                  />
                  <Field
                    label="Completed"
                    value={
                      record.completed_at ? new Date(record.completed_at).toLocaleString() : null
                    }
                  />
                  {record.has_oil_change && (
                    <Field
                      label="Odometer"
                      value={`${record.current_odometer?.toLocaleString() ?? "—"} km (next: ${record.next_service_odometer?.toLocaleString() ?? "—"} km)`}
                    />
                  )}
                </div>
                {record.remarks && (
                  <div className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Remarks</p>
                    <p className="text-foreground whitespace-pre-wrap">{record.remarks}</p>
                  </div>
                )}
                {record.items?.length > 0 && (
                  <div className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Additional Work / Parts Needed
                    </p>
                    <ul className="list-disc list-inside text-foreground">
                      {record.items.map((it, idx) => (
                        <li key={idx}>
                          {it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {record && (record.supervisor_name || assignments.length > 0) && (
              <Section title="Staff Assignment">
                <Field label="Supervisor" value={record.supervisor_name} />
                {assignments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Assigned Staff</p>
                    <ul className="space-y-1">
                      {assignments.map((a) => (
                        <li key={a.assignment_id} className="text-sm text-foreground">
                          <span className="font-medium">{a.staff_name}</span>
                          {a.work_note && (
                            <span className="text-muted-foreground"> — {a.work_note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {invoice && (
              <Section title="Invoice">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    Total: LKR {Number(invoice.total_amount).toLocaleString()}
                  </span>
                  <button
                    onClick={() => onViewInvoice(invoice)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3 w-3" /> View Invoice
                  </button>
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
