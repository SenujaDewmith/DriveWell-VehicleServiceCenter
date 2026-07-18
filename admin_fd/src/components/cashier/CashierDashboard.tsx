import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { Printer, Plus, Trash2, X } from "lucide-react";

interface ApiBooking {
  reservation_id: number;
  booking_ref: string | null;
  status: string;
  customer_name: string;
  plate_no: string;
  package_name: string;
}

interface InvoiceDraft {
  reservation_id: number;
  booking_ref: string | null;
  customer_name: string;
  make: string;
  model: string;
  vehicle_type: string;
  plate_no: string;
  package_name: string;
  package_price: string;
  remarks: string | null;
  suggested_items: {
    catalog_item_id: number | null;
    description: string;
    quantity: number;
    suggested_price: string | null;
  }[];
}

interface LineItem {
  catalog_item_id: number | null;
  description: string;
  unit_price: number;
  quantity: number;
}

interface CatalogItem {
  catalog_item_id: number;
  name: string;
  default_price: string;
  is_active: boolean;
}

interface CreatedInvoice {
  invoice_id: number;
  base_amount: string;
  discount: string;
  total_amount: string;
  items: { description: string; unit_price: string; quantity: number; line_total: string }[];
}

interface UnpaidInvoice {
  invoice_id: number;
  booking_ref: string | null;
  customer_name: string;
  plate_no: string;
  package_name: string;
  total_amount: string;
  payment_method: string | null;
}

export function CashierDashboard() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [baseAmount, setBaseAmount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card">("Cash");
  const [addCatalogId, setAddCatalogId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);

  const loadUnpaidInvoices = () => {
    api
      .get<{ invoices: UnpaidInvoice[] }>(`/api/invoices?payment_status=${encodeURIComponent("Unpaid")}`)
      .then((d) => setUnpaidInvoices(d.invoices))
      .catch(() => {});
  };

  useEffect(loadUnpaidInvoices, []);

  const markInvoicePaid = async (invoiceId: number, method: "Cash" | "Card") => {
    setMarkingPaidId(invoiceId);
    setError("");
    try {
      await api.patch(`/api/invoices/${invoiceId}/payment`, { payment_status: "Paid", payment_method: method });
      loadUnpaidInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const loadBookings = () => {
    setLoading(true);
    Promise.all([
      api.get<{ bookings: ApiBooking[] }>(`/api/bookings?status=${encodeURIComponent("Ready for Pickup")}`),
      api.get<{ bookings: ApiBooking[] }>(`/api/bookings?status=${encodeURIComponent("Completed")}`),
      api.get<{ invoices: { reservation_id: number }[] }>("/api/invoices"),
    ])
      .then(([ready, completed, invoiced]) => {
        const invoicedIds = new Set(invoiced.invoices.map((i) => i.reservation_id));
        const merged = [...ready.bookings, ...completed.bookings].filter((b) => !invoicedIds.has(b.reservation_id));
        setBookings(merged);
      })
      .catch(() => setError("Failed to load billable bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(loadBookings, []);

  useEffect(() => {
    api.get<{ items: CatalogItem[] }>("/api/charge-catalog").then((d) => setCatalog(d.items.filter((i) => i.is_active))).catch(() => {});
  }, []);

  const selectBooking = (id: number) => {
    setSelectedId(id);
    setShowInvoice(false);
    setCreatedInvoice(null);
    setError("");
    setDraftLoading(true);
    api
      .get<InvoiceDraft>(`/api/invoices/draft/${id}`)
      .then((d) => {
        setDraft(d);
        setBaseAmount(parseFloat(d.package_price));
        setItems(
          d.suggested_items.map((it) => ({
            catalog_item_id: it.catalog_item_id,
            description: it.description,
            unit_price: it.suggested_price ? parseFloat(it.suggested_price) : 0,
            quantity: it.quantity,
          }))
        );
        setDiscount(0);
      })
      .catch(() => setError("Failed to load invoice draft"))
      .finally(() => setDraftLoading(false));
  };

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCatalogItem = () => {
    if (!addCatalogId) return;
    const c = catalog.find((c) => c.catalog_item_id === Number(addCatalogId));
    if (!c) return;
    setItems((prev) => [...prev, { catalog_item_id: c.catalog_item_id, description: c.name, unit_price: parseFloat(c.default_price), quantity: 1 }]);
    setAddCatalogId("");
  };

  const addCustomItem = () => {
    setItems((prev) => [...prev, { catalog_item_id: null, description: "", unit_price: 0, quantity: 1 }]);
  };

  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const total = baseAmount + itemsTotal - discount;

  const generateInvoice = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post<{ invoice: CreatedInvoice }>("/api/invoices", {
        reservation_id: selectedId,
        base_amount: baseAmount,
        items: items.filter((it) => it.description.trim()),
        discount,
        payment_method: paymentMethod,
      });
      setCreatedInvoice(res.invoice);
      setShowInvoice(true);
      loadBookings();
      loadUnpaidInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Billing</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Ready for billing table */}
        <div className="flex-1 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ready for Billing</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Package</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!loading && bookings.map((b) => (
                  <tr key={b.reservation_id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">{b.booking_ref ?? `#${b.reservation_id}`}</td>
                    <td className="py-2 px-2 text-foreground">{b.customer_name}</td>
                    <td className="py-2 px-2 text-foreground">{b.plate_no}</td>
                    <td className="py-2 px-2 text-foreground">{b.package_name}</td>
                    <td className="py-2 px-2"><StatusBadge status={b.status} /></td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => selectBooking(b.reservation_id)}
                        className="rounded-md border border-accent px-2 py-1 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        Bill
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No vehicles ready for billing
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Unpaid invoices awaiting payment */}
          <h3 className="text-sm font-semibold text-foreground mb-4 mt-6">Awaiting Payment</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Total (LKR)</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">{inv.booking_ref ?? `#${inv.invoice_id}`}</td>
                    <td className="py-2 px-2 text-foreground">{inv.customer_name}</td>
                    <td className="py-2 px-2 text-foreground">{inv.plate_no}</td>
                    <td className="py-2 px-2 text-foreground">{parseFloat(inv.total_amount).toLocaleString()}</td>
                    <td className="py-2 px-2 text-foreground">{inv.payment_method ?? "—"}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => markInvoicePaid(inv.invoice_id, (inv.payment_method as "Cash" | "Card") ?? "Cash")}
                        disabled={markingPaidId === inv.invoice_id}
                        className="rounded-md border border-chart-1 px-2 py-1 text-sm font-medium text-chart-1 hover:bg-chart-1 hover:text-accent-foreground transition-colors disabled:opacity-50"
                      >
                        {markingPaidId === inv.invoice_id ? "..." : "Mark as Paid"}
                      </button>
                    </td>
                  </tr>
                ))}
                {unpaidInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No unpaid invoices
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice builder */}
        {selectedId && !showInvoice && (
          <div className="w-full lg:w-104 rounded-lg border border-border bg-card p-4 space-y-4 h-fit">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-foreground">Invoice Builder</h3>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {draftLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!draftLoading && draft && (
              <>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Customer:</span> {draft.customer_name}</p>
                  <p><span className="text-muted-foreground">Vehicle:</span> {draft.plate_no} — {draft.make} {draft.model} ({draft.vehicle_type})</p>
                  <p><span className="text-muted-foreground">Package:</span> {draft.package_name}</p>
                  {draft.remarks && <p><span className="text-muted-foreground">Supervisor Remarks:</span> {draft.remarks}</p>}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Base Price ({draft.package_name}, {draft.vehicle_type})</span>
                    <input
                      type="number"
                      value={baseAmount}
                      onChange={(e) => setBaseAmount(Number(e.target.value))}
                      className="w-28 border border-border rounded-md bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Package base rate is LKR {parseFloat(draft.package_price).toLocaleString()} upwards — adjust for this vehicle if needed.
                  </p>

                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-sm">
                      <input
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="Item description"
                        className="flex-1 border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                        className="w-12 border border-border rounded-md bg-background px-1 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        value={it.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                        className="w-20 border border-border rounded-md bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-1">
                    <select
                      value={addCatalogId}
                      onChange={(e) => setAddCatalogId(e.target.value)}
                      className="flex-1 border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Add from charge catalog —</option>
                      {catalog.map((c) => (
                        <option key={c.catalog_item_id} value={c.catalog_item_id}>
                          {c.name} (LKR {parseFloat(c.default_price).toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <button onClick={addCatalogItem} className="rounded-md border border-accent px-2 py-1 text-sm text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button onClick={addCustomItem} className="w-full flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:border-muted-foreground transition-colors">
                    <Plus className="h-3 w-3" /> Add Custom Line
                  </button>

                  <div className="flex justify-between items-center text-sm pt-1">
                    <span className="text-muted-foreground">Discount</span>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-28 border border-border rounded-md bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-accent">LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                  <div className="flex gap-2 mt-1">
                    {(["Cash", "Card"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                          paymentMethod === m
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateInvoice}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  {submitting ? "Generating..." : "Generate & Print Invoice"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Print-ready invoice */}
      {showInvoice && createdInvoice && draft && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-lg">
            <div className="flex justify-between items-center p-4 border-b border-border no-print">
              <span className="text-sm font-medium text-muted-foreground">Invoice Preview</span>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="rounded-md border border-accent px-3 py-1 text-sm text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Printer className="h-3 w-3 inline mr-1" />Print
                </button>
                <button onClick={() => { setShowInvoice(false); setSelectedId(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-6 print:p-4" id="invoice-print">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground">DriveWell</h2>
                <p className="text-sm text-muted-foreground">Service Center — Invoice</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date().toLocaleDateString()} // {draft.booking_ref ?? `#${draft.reservation_id}`}
                </p>
              </div>

              <div className="space-y-1 text-sm mb-4">
                <p>Customer: {draft.customer_name}</p>
                <p>Vehicle: {draft.plate_no} — {draft.make} {draft.model} ({draft.vehicle_type})</p>
              </div>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b-2 border-foreground">
                    <th className="text-left py-1">Item</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-1">{draft.package_name}</td>
                    <td className="text-right py-1">LKR {parseFloat(createdInvoice.base_amount).toLocaleString()}</td>
                  </tr>
                  {createdInvoice.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-border">
                      <td className="py-1">{it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}</td>
                      <td className="text-right py-1">LKR {parseFloat(it.line_total).toLocaleString()}</td>
                    </tr>
                  ))}
                  {parseFloat(createdInvoice.discount) > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-1">Discount</td>
                      <td className="text-right py-1">-LKR {parseFloat(createdInvoice.discount).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground font-bold">
                    <td className="py-2">Total</td>
                    <td className="text-right py-2">LKR {parseFloat(createdInvoice.total_amount).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="text-sm text-muted-foreground">
                <p>Payment: {paymentMethod}</p>
                <p className="mt-4 text-center text-sm">Thank you for choosing DriveWell!</p>
              </div>
            </div>
            <div className="p-4 border-t border-border no-print">
              <button
                onClick={async () => {
                  await markInvoicePaid(createdInvoice.invoice_id, paymentMethod);
                  setShowInvoice(false);
                  setSelectedId(null);
                }}
                disabled={markingPaidId === createdInvoice.invoice_id}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-chart-1 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {markingPaidId === createdInvoice.invoice_id ? "Updating..." : "Mark as Paid Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
