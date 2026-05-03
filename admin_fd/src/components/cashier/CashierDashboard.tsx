import { useState, useRef } from "react";
import { getReadyForBilling, getPackagePrice, type Booking } from "@/data/dummyData";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { Printer, X } from "lucide-react";

export function CashierDashboard() {
  const readyBookings = getReadyForBilling();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card">("Cash");
  const [showInvoice, setShowInvoice] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const selected = readyBookings.find((b) => b.id === selectedId);

  const basePrice = selected ? getPackagePrice(selected.package) : 0;
  const addOnsTotal = selected
    ? selected.addOns.reduce((s, a) => s + a.price, 0)
    : 0;
  const total = basePrice + addOnsTotal - discount;

  const handlePrint = () => {
    setShowInvoice(true);
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">BILLING</h1>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Ready for billing table */}
        <div className="flex-1 border-2 border-border bg-card p-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Ready for Billing</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">ID</th>
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">Vehicle</th>
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">Package</th>
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-2 uppercase text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {readyBookings.map((b) => (
                  <tr key={b.id} className="border-b border-border">
                    <td className="py-2 px-2 text-muted-foreground">{b.id}</td>
                    <td className="py-2 px-2 text-foreground">{b.customerName}</td>
                    <td className="py-2 px-2 text-foreground">{b.vehicle.plate}</td>
                    <td className="py-2 px-2 text-foreground">{b.package}</td>
                    <td className="py-2 px-2"><StatusBadge status={b.status} /></td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => { setSelectedId(b.id); setDiscount(b.discount); }}
                        className="border border-accent px-2 py-1 text-[10px] uppercase text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        Bill
                      </button>
                    </td>
                  </tr>
                ))}
                {readyBookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No vehicles ready for billing
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice builder */}
        {selected && !showInvoice && (
          <div className="w-full lg:w-96 border-2 border-border bg-card p-4 space-y-4 h-fit">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold uppercase">Invoice Builder</h3>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <p><span className="text-muted-foreground">Customer:</span> {selected.customerName}</p>
              <p><span className="text-muted-foreground">Vehicle:</span> {selected.vehicle.plate}</p>
              <p><span className="text-muted-foreground">Package:</span> {selected.package}</p>
            </div>

            <div className="border-t-2 border-border pt-3 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Base Price</span>
                <span className="text-foreground">LKR {basePrice.toLocaleString()}</span>
              </div>
              {selected.addOns.map((a) => (
                <div key={a.name} className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">+ {a.name}</span>
                  <span className="text-foreground">LKR {a.price.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">Discount</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 border border-border bg-background px-2 py-1 text-right text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex justify-between text-sm font-bold border-t-2 border-border pt-2">
                <span>TOTAL</span>
                <span className="text-accent">LKR {total.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Payment Method</label>
              <div className="flex gap-2 mt-1">
                {(["Cash", "Card"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 border-2 py-2 text-xs font-mono uppercase font-bold transition-colors ${
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
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 border-2 border-accent bg-accent py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
            >
              <Printer className="h-4 w-4" />
              Generate & Print Invoice
            </button>
          </div>
        )}
      </div>

      {/* Print-ready invoice */}
      {showInvoice && selected && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border-2 border-border">
            <div className="flex justify-between items-center p-4 border-b-2 border-border no-print">
              <span className="text-xs font-mono uppercase text-muted-foreground">Invoice Preview</span>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="border border-accent px-3 py-1 text-xs font-mono uppercase text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Printer className="h-3 w-3 inline mr-1" />Print
                </button>
                <button onClick={() => setShowInvoice(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div ref={invoiceRef} className="p-6 print:p-4" id="invoice-print">
              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold tracking-tighter">DRIVEWELL</h2>
                <p className="text-[10px] font-mono text-muted-foreground">SERVICE CENTER — INVOICE</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  {new Date().toLocaleDateString()} // {selected.id}
                </p>
              </div>

              <div className="space-y-1 text-xs font-mono mb-4">
                <p>Customer: {selected.customerName}</p>
                <p>Phone: {selected.phone}</p>
                <p>Vehicle: {selected.vehicle.plate} — {selected.vehicle.color} {selected.vehicle.make} {selected.vehicle.model}</p>
              </div>

              <table className="w-full text-xs font-mono mb-4">
                <thead>
                  <tr className="border-b-2 border-foreground">
                    <th className="text-left py-1">Item</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-1">{selected.package}</td>
                    <td className="text-right py-1">LKR {basePrice.toLocaleString()}</td>
                  </tr>
                  {selected.addOns.map((a) => (
                    <tr key={a.name} className="border-b border-border">
                      <td className="py-1">{a.name}</td>
                      <td className="text-right py-1">LKR {a.price.toLocaleString()}</td>
                    </tr>
                  ))}
                  {discount > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-1">Discount</td>
                      <td className="text-right py-1">-LKR {discount.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground font-bold">
                    <td className="py-2">TOTAL</td>
                    <td className="text-right py-2">LKR {total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="text-xs font-mono text-muted-foreground">
                <p>Payment: {paymentMethod}</p>
                <p className="mt-4 text-center text-[10px]">Thank you for choosing DriveWell!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
