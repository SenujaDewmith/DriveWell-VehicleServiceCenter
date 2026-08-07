import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import {
  InvoiceDocument,
  InvoiceViewModal,
  SupervisorServiceDetails,
} from "@/components/invoices/InvoiceView";
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
import { Eye, Printer, Plus, Search, Trash2, X } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 500;

// Shared between the "Awaiting Payment" desktop table's Action column and the
// mobile/tablet card list's action row, so the confirmation copy only lives in one place.
function MarkPaidAlertDialog({ invoice, marking, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={marking}
          className="rounded-md border border-chart-1 px-2 py-1 text-sm font-medium text-chart-1 hover:bg-chart-1 hover:text-accent-foreground transition-colors disabled:opacity-50"
        >
          {marking ? "..." : "Mark as Paid"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mark {invoice.booking_ref ?? `#${invoice.invoice_id}`} as paid?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Confirms LKR {parseFloat(invoice.total_amount).toLocaleString()} was received
            from {invoice.customer_name} ({invoice.payment_method ?? "Cash"}). This marks the
            service as Completed & Paid — the Supervisor will then verify payment and
            release the vehicle. This can't be undone from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm Payment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CashierDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);

  const [baseAmount, setBaseAmount] = useState(0);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [addCatalogId, setAddCatalogId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const loadUnpaidInvoices = () => {
    api
      .get(`/api/invoices?payment_status=${encodeURIComponent("Unpaid")}`)
      .then((d) => setUnpaidInvoices(d.invoices))
      .catch(() => {});
  };

  useEffect(loadUnpaidInvoices, []);

  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historySearchTimerRef = useRef(null);

  const loadInvoiceHistory = (search) => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyFrom) params.set("from", historyFrom);
    if (historyTo) params.set("to", historyTo);
    if (search.trim()) params.set("q", search.trim());
    api
      .get(`/api/invoices?${params.toString()}`)
      .then((d) => setHistoryInvoices(d.invoices))
      .catch(() => setError("Failed to load invoice history"))
      .finally(() => setHistoryLoading(false));
  };

  // Date changes refetch immediately; typing in the search box debounces so we
  // don't fire a request on every keystroke.
  useEffect(() => {
    loadInvoiceHistory(historySearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFrom, historyTo]);

  const handleHistorySearchChange = (value) => {
    setHistorySearch(value);
    if (historySearchTimerRef.current) clearTimeout(historySearchTimerRef.current);
    historySearchTimerRef.current = setTimeout(() => loadInvoiceHistory(value), SEARCH_DEBOUNCE_MS);
  };

  // The list response already carries full item breakdowns, so viewing a past
  // invoice just opens a modal against the row we already have — no refetch.
  const [viewInvoice, setViewInvoice] = useState(null);

  const markInvoicePaid = async (invoiceId, method) => {
    setMarkingPaidId(invoiceId);
    setError("");
    try {
      await api.patch(`/api/invoices/${invoiceId}/payment`, {
        payment_status: "Paid",
        payment_method: method,
      });
      loadUnpaidInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const loadBookings = () => {
    setLoading(true);
    // "Ready for Pickup" no longer exists as a stored status — a booking that's Completed
    // and already invoiced simply won't be Completed anymore once paid (payment doesn't
    // change the reservation status), so the invoicedIds filter below is the only guard needed.
    Promise.all([
      api.get(`/api/bookings?status=${encodeURIComponent("Completed")}`),
      api.get("/api/invoices"),
    ])
      .then(([completed, invoiced]) => {
        const invoicedIds = new Set(invoiced.invoices.map((i) => i.reservation_id));
        const merged = completed.bookings.filter((b) => !invoicedIds.has(b.reservation_id));
        setBookings(merged);
      })
      .catch(() => setError("Failed to load billable bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(loadBookings, []);

  useEffect(() => {
    api
      .get("/api/charge-catalog")
      .then((d) => setCatalog(d.items.filter((i) => i.is_active)))
      .catch(() => {});
  }, []);

  const selectBooking = (id) => {
    setSelectedId(id);
    setShowInvoice(false);
    setCreatedInvoice(null);
    setError("");
    setDraftLoading(true);
    api
      .get(`/api/invoices/draft/${id}`)
      .then((d) => {
        setDraft(d);
        setBaseAmount(parseFloat(d.package_price));
        setItems(
          d.suggested_items.map((it) => ({
            catalog_item_id: it.catalog_item_id,
            description: it.description,
            unit_price: it.suggested_price ? parseFloat(it.suggested_price) : 0,
            quantity: it.quantity,
          })),
        );
        setDiscount(0);
      })
      .catch(() => setError("Failed to load invoice draft"))
      .finally(() => setDraftLoading(false));
  };

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCatalogItem = () => {
    if (!addCatalogId) return;
    const c = catalog.find((c) => c.catalog_item_id === Number(addCatalogId));
    if (!c) return;
    setItems((prev) => [
      ...prev,
      {
        catalog_item_id: c.catalog_item_id,
        description: c.name,
        unit_price: parseFloat(c.default_price),
        quantity: 1,
      },
    ]);
    setAddCatalogId("");
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      { catalog_item_id: null, description: "", unit_price: 0, quantity: 1 },
    ]);
  };

  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const total = baseAmount + itemsTotal - discount;

  const generateInvoice = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/api/invoices", {
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
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Ready for billing table */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Ready for Billing</h3>
        {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
        <div className="hidden lg:block overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading &&
                bookings.map((b) => (
                  <tr key={b.reservation_id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">
                      {b.booking_ref ?? `#${b.reservation_id}`}
                    </td>
                    <td className="py-2 px-2 text-foreground">{b.customer_name}</td>
                    <td className="py-2 px-2 text-foreground">{b.customer_phone ?? "—"}</td>
                    <td className="py-2 px-2 text-foreground">{b.plate_no}</td>
                    <td className="py-2 px-2 text-foreground">{b.package_name}</td>
                    <td className="py-2 px-2">
                      <StatusBadge status={b.status} />
                    </td>
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
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No vehicles ready for billing
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
        <div className="lg:hidden space-y-3">
          {loading && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          )}
          {!loading &&
            bookings.map((b) => (
              <DataCard key={b.reservation_id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {b.booking_ref ?? `#${b.reservation_id}`}
                  </p>
                  <StatusBadge status={b.status} />
                </div>
                <DataCardField label="Customer" value={b.customer_name} />
                <DataCardField label="Phone" value={b.customer_phone} />
                <DataCardField label="Vehicle" value={b.plate_no} />
                <DataCardField label="Package" value={b.package_name} />
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => selectBooking(b.reservation_id)}
                    className="rounded-md border border-accent px-2 py-1 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Bill
                  </button>
                </div>
              </DataCard>
            ))}
          {!loading && bookings.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No vehicles ready for billing
            </div>
          )}
        </div>

        {/* Unpaid invoices awaiting payment */}
        <h3 className="text-sm font-semibold text-foreground mb-4 mt-6">Awaiting Payment</h3>
        {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
        <div className="hidden lg:block overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                  Total (LKR)
                </th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Method</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {unpaidInvoices.map((inv) => (
                <tr key={inv.invoice_id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-muted-foreground">
                    {inv.booking_ref ?? `#${inv.invoice_id}`}
                  </td>
                  <td className="py-2 px-2 text-foreground">{inv.customer_name}</td>
                  <td className="py-2 px-2 text-foreground">{inv.customer_phone ?? "—"}</td>
                  <td className="py-2 px-2 text-foreground">{inv.plate_no}</td>
                  <td className="py-2 px-2 text-foreground">
                    {parseFloat(inv.total_amount).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-foreground">{inv.payment_method ?? "—"}</td>
                  <td className="py-2 px-2">
                    <MarkPaidAlertDialog
                      invoice={inv}
                      marking={markingPaidId === inv.invoice_id}
                      onConfirm={() => markInvoicePaid(inv.invoice_id, inv.payment_method ?? "Cash")}
                    />
                  </td>
                </tr>
              ))}
              {unpaidInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No unpaid invoices
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
        <div className="lg:hidden space-y-3">
          {unpaidInvoices.map((inv) => (
            <DataCard key={inv.invoice_id}>
              <p className="font-semibold text-foreground">
                {inv.booking_ref ?? `#${inv.invoice_id}`}
              </p>
              <DataCardField label="Customer" value={inv.customer_name} />
              <DataCardField label="Phone" value={inv.customer_phone} />
              <DataCardField label="Vehicle" value={inv.plate_no} />
              <DataCardField
                label="Total (LKR)"
                value={parseFloat(inv.total_amount).toLocaleString()}
              />
              <DataCardField label="Method" value={inv.payment_method ?? "—"} />
              <div className="pt-2 border-t border-border">
                <MarkPaidAlertDialog
                  invoice={inv}
                  marking={markingPaidId === inv.invoice_id}
                  onConfirm={() => markInvoicePaid(inv.invoice_id, inv.payment_method ?? "Cash")}
                />
              </div>
            </DataCard>
          ))}
          {unpaidInvoices.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No unpaid invoices
            </div>
          )}
        </div>

        {/* Invoice history — searchable by date range and ref/customer name */}
        <h3 className="text-sm font-semibold text-foreground mb-4 mt-6">Invoice History</h3>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="date"
            value={historyFrom}
            onChange={(e) => setHistoryFrom(e.target.value)}
            className="border border-border rounded-md bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={historyTo}
            onChange={(e) => setHistoryTo(e.target.value)}
            className="border border-border rounded-md bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="relative flex-1 min-w-45">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={historySearch}
              onChange={(e) => handleHistorySearchChange(e.target.value)}
              placeholder="Search by ref or customer name..."
              className="w-full border border-border rounded-md bg-background pl-7 pr-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
        <div className="hidden lg:block overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                  Total (LKR)
                </th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!historyLoading &&
                historyInvoices.map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">
                      {inv.booking_ref ?? `#${inv.invoice_id}`}
                    </td>
                    <td className="py-2 px-2 text-foreground">{inv.service_date ?? "—"}</td>
                    <td className="py-2 px-2 text-foreground">{inv.customer_name}</td>
                    <td className="py-2 px-2 text-foreground">{inv.customer_phone ?? "—"}</td>
                    <td className="py-2 px-2 text-foreground">{inv.plate_no}</td>
                    <td className="py-2 px-2 text-foreground">
                      {parseFloat(inv.total_amount).toLocaleString()}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          inv.payment_status === "Paid" ? "text-chart-1" : "text-muted-foreground"
                        }
                      >
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => setViewInvoice(inv)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              {!historyLoading && historyInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No invoices match this search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
        <div className="lg:hidden space-y-3">
          {historyLoading && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          )}
          {!historyLoading &&
            historyInvoices.map((inv) => (
              <DataCard key={inv.invoice_id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {inv.booking_ref ?? `#${inv.invoice_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{inv.service_date ?? "—"}</p>
                  </div>
                  <span
                    className={`text-sm font-medium shrink-0 ${
                      inv.payment_status === "Paid" ? "text-chart-1" : "text-muted-foreground"
                    }`}
                  >
                    {inv.payment_status}
                  </span>
                </div>
                <DataCardField label="Customer" value={inv.customer_name} />
                <DataCardField label="Phone" value={inv.customer_phone} />
                <DataCardField label="Vehicle" value={inv.plate_no} />
                <DataCardField
                  label="Total (LKR)"
                  value={parseFloat(inv.total_amount).toLocaleString()}
                />
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => setViewInvoice(inv)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                </div>
              </DataCard>
            ))}
          {!historyLoading && historyInvoices.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No invoices match this search
            </div>
          )}
        </div>
      </div>

      {/* Invoice builder */}
      {selectedId && !showInvoice && (
        <div
          className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card p-4 space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-foreground">Invoice Builder</h3>
              <button
                onClick={() => setSelectedId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {draftLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!draftLoading && draft && (
              <>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Customer:</span> {draft.customer_name}
                  </p>
                  {draft.customer_phone && (
                    <p>
                      <span className="text-muted-foreground">Phone:</span> {draft.customer_phone}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Vehicle:</span> {draft.plate_no} —{" "}
                    {draft.make} {draft.model} ({draft.vehicle_type})
                  </p>
                  <p>
                    <span className="text-muted-foreground">Package:</span> {draft.package_name}
                  </p>
                  {draft.has_oil_change && (
                    <p>
                      <span className="text-muted-foreground">Odometer:</span>{" "}
                      {draft.current_odometer?.toLocaleString() ?? "—"} km
                      {" → next service at "}
                      {draft.next_service_odometer?.toLocaleString() ?? "—"} km
                    </p>
                  )}
                </div>

                <SupervisorServiceDetails remarks={draft.remarks} items={draft.suggested_items} />

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Base Price ({draft.package_name}, {draft.vehicle_type})
                    </span>
                    <input
                      type="number"
                      value={baseAmount}
                      onChange={(e) => setBaseAmount(Number(e.target.value))}
                      className="w-28 border border-border rounded-md bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Package base rate is LKR {parseFloat(draft.package_price).toLocaleString()}{" "}
                    upwards — adjust for this vehicle if needed.
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
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-destructive"
                      >
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
                    <button
                      onClick={addCatalogItem}
                      className="rounded-md border border-accent px-2 py-1 text-sm text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={addCustomItem}
                    className="w-full flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:border-muted-foreground transition-colors"
                  >
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
                  <label className="text-sm font-medium text-muted-foreground">
                    Payment Method
                  </label>
                  <div className="flex gap-2 mt-1">
                    {["Cash", "Card"].map((m) => (
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
        </div>
      )}

      {/* Print-ready invoice */}
      {showInvoice && createdInvoice && draft && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg">
            <div className="flex justify-between items-center p-3 border-b border-border no-print">
              <span className="text-sm font-medium text-muted-foreground">Invoice Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="rounded-md border border-accent px-3 py-1 text-sm text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Printer className="h-3 w-3 inline mr-1" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowInvoice(false);
                    setSelectedId(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <SupervisorServiceDetails
              remarks={draft.remarks}
              items={draft.suggested_items}
              className="mx-3 mt-3"
            />
            <InvoiceDocument
              bookingRef={draft.booking_ref}
              dateLabel={new Date().toLocaleDateString()}
              customerName={draft.customer_name}
              customerPhone={draft.customer_phone}
              vehicleLine={`${draft.plate_no} — ${draft.make} ${draft.model} (${draft.vehicle_type})`}
              packageName={draft.package_name}
              baseAmount={parseFloat(createdInvoice.base_amount)}
              items={createdInvoice.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                lineTotal: parseFloat(it.line_total),
              }))}
              discount={parseFloat(createdInvoice.discount)}
              totalAmount={parseFloat(createdInvoice.total_amount)}
              paymentMethod={paymentMethod}
              hasOilChange={draft.has_oil_change}
              currentOdometer={draft.current_odometer}
              nextServiceOdometer={draft.next_service_odometer}
            />
            <div className="p-3 border-t border-border no-print flex gap-2">
              <button
                onClick={() => {
                  setShowInvoice(false);
                  setSelectedId(null);
                }}
                className="flex-1 rounded-md border border-border py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Close (Awaiting Payment)
              </button>
              <button
                onClick={async () => {
                  await markInvoicePaid(createdInvoice.invoice_id, paymentMethod);
                  setShowInvoice(false);
                  setSelectedId(null);
                }}
                disabled={markingPaidId === createdInvoice.invoice_id}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-chart-1 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {markingPaidId === createdInvoice.invoice_id ? "Updating..." : "Mark as Paid Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only view of a past invoice, opened from Invoice History */}
      {viewInvoice && (
        <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
    </div>
  );
}
