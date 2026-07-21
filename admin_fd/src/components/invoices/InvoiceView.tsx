import { Printer, X } from "lucide-react";

export interface InvoiceViewData {
  invoice_id: number;
  booking_ref: string | null;
  generated_at: string;
  customer_name: string;
  make: string;
  model: string;
  vehicle_type: string;
  plate_no: string;
  package_name: string;
  base_amount: string;
  discount: string;
  total_amount: string;
  payment_status: string;
  payment_method: string | null;
  items: { description: string; quantity: number; line_total: string }[];
  has_oil_change?: boolean;
  current_odometer?: number | null;
  next_service_odometer?: number | null;
  supervisor_remarks?: string | null;
  supervisor_items?: { description: string; quantity: number }[];
}

interface InvoiceDocumentProps {
  bookingRef: string | null;
  dateLabel: string;
  customerName: string;
  vehicleLine: string;
  packageName: string;
  baseAmount: number;
  items: { description: string; quantity: number; lineTotal: number }[];
  discount: number;
  totalAmount: number;
  paymentMethod: string | null;
  hasOilChange?: boolean;
  currentOdometer?: number | null;
  nextServiceOdometer?: number | null;
}

// The printable invoice body — the single receipt layout every admin surface
// (Cashier, Manager, Supervisor) renders, so they can never visually drift apart.
export function InvoiceDocument({
  bookingRef, dateLabel, customerName, vehicleLine, packageName,
  baseAmount, items, discount, totalAmount, paymentMethod,
  hasOilChange, currentOdometer, nextServiceOdometer,
}: InvoiceDocumentProps) {
  return (
    <div className="p-4 print:p-4" id="invoice-print">
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-foreground">DriveWell</h2>
        <p className="text-xs text-muted-foreground">Service Center — Invoice</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dateLabel} // {bookingRef ?? "—"}
        </p>
      </div>

      <div className="space-y-0.5 text-sm mb-3">
        <p>Customer: {customerName}</p>
        <p>Vehicle: {vehicleLine}</p>
      </div>

      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="border-b-2 border-foreground">
            <th className="text-left py-0.5">Item</th>
            <th className="text-right py-0.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="py-0.5">{packageName}</td>
            <td className="text-right py-0.5">LKR {baseAmount.toLocaleString()}</td>
          </tr>
          {items.map((it, idx) => (
            <tr key={idx} className="border-b border-border">
              <td className="py-0.5">{it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}</td>
              <td className="text-right py-0.5">LKR {it.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
          {discount > 0 && (
            <tr className="border-b border-border">
              <td className="py-0.5">Discount</td>
              <td className="text-right py-0.5">-LKR {discount.toLocaleString()}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground font-bold">
            <td className="py-1">Total</td>
            <td className="text-right py-1">LKR {totalAmount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div className="text-xs text-muted-foreground">
        <p>Payment: {paymentMethod ?? "—"}</p>
        {hasOilChange && (
          <p className="mt-1">
            Odometer: {currentOdometer?.toLocaleString() ?? "—"} km — Next service due at{" "}
            <span className="font-medium text-foreground">{nextServiceOdometer?.toLocaleString() ?? "—"} km</span>
          </p>
        )}
        <p className="mt-2 text-center text-xs">Thank you for choosing DriveWell!</p>
      </div>
    </div>
  );
}

// Read-only reference box for what the supervisor logged during service — shown
// on screen for admin staff only, excluded from the printed receipt via no-print
// (this is internal context, not something that belongs on the customer's bill).
export function SupervisorServiceDetails({
  remarks, items, className = "",
}: {
  remarks?: string | null;
  items?: { description: string; quantity: number }[];
  className?: string;
}) {
  const hasRemarks = !!remarks;
  const hasItems = !!items && items.length > 0;
  if (!hasRemarks && !hasItems) return null;

  return (
    <div className={`space-y-1.5 text-sm rounded-md border border-border p-2.5 no-print ${className}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Details — added by Supervisor</p>
      {hasRemarks && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Remarks</p>
          <p className="text-foreground whitespace-pre-wrap">{remarks}</p>
        </div>
      )}
      {hasItems && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Additional Work / Parts Needed</p>
          <ul className="list-disc list-inside text-foreground">
            {items!.map((it, idx) => (
              <li key={idx}>
                {it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Full read-only "view an existing invoice" modal — used anywhere an admin actor
// (Cashier, Manager, Supervisor) looks up a bill that's already been generated.
export function InvoiceViewModal({ invoice, onClose }: { invoice: InvoiceViewData; onClose: () => void }) {
  const handlePrint = () => setTimeout(() => window.print(), 300);

  return (
    <div
      className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-3 border-b border-border no-print">
          <span className="text-sm font-medium text-muted-foreground">Invoice Preview</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="rounded-md border border-accent px-3 py-1 text-sm text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
              <Printer className="h-3 w-3 inline mr-1" />Print
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <SupervisorServiceDetails
          remarks={invoice.supervisor_remarks}
          items={invoice.supervisor_items}
          className="mx-3 mt-3"
        />

        <InvoiceDocument
          bookingRef={invoice.booking_ref}
          dateLabel={new Date(invoice.generated_at).toLocaleDateString()}
          customerName={invoice.customer_name}
          vehicleLine={`${invoice.plate_no} — ${invoice.make} ${invoice.model} (${invoice.vehicle_type})`}
          packageName={invoice.package_name}
          baseAmount={parseFloat(invoice.base_amount)}
          items={invoice.items.map((it) => ({ description: it.description, quantity: it.quantity, lineTotal: parseFloat(it.line_total) }))}
          discount={parseFloat(invoice.discount)}
          totalAmount={parseFloat(invoice.total_amount)}
          paymentMethod={invoice.payment_method}
          hasOilChange={invoice.has_oil_change}
          currentOdometer={invoice.current_odometer}
          nextServiceOdometer={invoice.next_service_odometer}
        />

        <div className="p-3 border-t border-border no-print">
          <span
            className={`inline-block rounded-md px-3 py-1 text-sm font-medium ${
              invoice.payment_status === "Paid" ? "bg-chart-1/10 text-chart-1" : "bg-muted text-muted-foreground"
            }`}
          >
            {invoice.payment_status}
          </span>
        </div>
      </div>
    </div>
  );
}
