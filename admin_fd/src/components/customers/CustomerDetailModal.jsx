import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";

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

// Read-only "everything about this customer" view — profile plus their vehicles and
// most recent bookings, so a manager or cashier can answer a walk-in/phone query
// without hunting across the Vehicle Catalog and All Bookings pages separately.
export function CustomerDetailModal({ customerId, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(`/api/users/customers/${customerId}`)
      .then((d) => {
        if (!cancelled) setCustomer(d.customer);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load customer");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

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
          <span className="text-sm font-medium text-muted-foreground">Customer Details</span>
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

        {customer && (
          <div className="p-3 space-y-3">
            <Section title="Profile">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={customer.full_name} />
                <Field
                  label="Status"
                  value={<span className="capitalize">{customer.account_status}</span>}
                />
                <Field label="Email" value={customer.email} />
                <Field label="Phone" value={customer.phone} />
                <Field label="Secondary Phone" value={customer.secondary_phone} />
                <Field
                  label="Joined"
                  value={new Date(customer.created_at).toISOString().slice(0, 10)}
                />
              </div>
              <Field label="Address" value={customer.address} />
            </Section>

            <Section title={`Vehicles (${customer.vehicles.length})`}>
              {customer.vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles registered</p>
              ) : (
                <div className="space-y-1">
                  {customer.vehicles.map((v) => (
                    <div key={v.vehicle_id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{v.plate_no}</span>
                      <span className="text-muted-foreground">
                        {[v.make, v.model, v.year].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Recent Bookings">
              {customer.recent_bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet</p>
              ) : (
                <div className="space-y-2">
                  {customer.recent_bookings.map((b) => (
                    <div
                      key={b.reservation_id}
                      className="flex items-center justify-between text-sm gap-2"
                    >
                      <div>
                        <p className="text-foreground">{b.booking_ref ?? `#${b.reservation_id}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.package_name} · {new Date(b.service_date).toISOString().slice(0, 10)}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
