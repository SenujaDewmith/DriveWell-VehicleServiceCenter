const { BRAND, createReportDoc, drawTable, finalizeFooters } = require("./pdf");

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" }) : "—";
const money = (v) => (v === null || v === undefined ? "—" : `LKR ${parseFloat(v).toLocaleString()}`);

// Vector-based PDF for a single invoice — same document every admin surface
// (Cashier/Manager preview, print) and the customer portal show on screen,
// just rendered server-side instead of per-client so there's one source of
// truth for the receipt layout.
function buildInvoicePdf(invoice) {
  const vehicleLine = `${invoice.plate_no ?? "—"} — ${[invoice.make, invoice.model].filter(Boolean).join(" ")}${invoice.vehicle_type ? ` (${invoice.vehicle_type})` : ""}`;

  const { doc, margin, contentWidth } = createReportDoc({
    title: invoice.booking_ref ? `Invoice ${invoice.booking_ref}` : `Invoice #${invoice.invoice_id}`,
    subtitle: `${fmtDate(invoice.service_date)}  •  ${invoice.payment_status}${invoice.payment_method ? ` (${invoice.payment_method})` : ""}`,
  });

  doc.font("Helvetica").fontSize(9).fillColor(BRAND.text);
  doc.text(`Customer: ${invoice.customer_name ?? "—"}`, margin, doc.y);
  if (invoice.customer_phone) doc.text(`Phone: ${invoice.customer_phone}`, margin, doc.y);
  doc.text(`Vehicle: ${vehicleLine}`, margin, doc.y);
  doc.moveDown(0.8);

  const rows = [{ description: invoice.package_name ?? "—", amount: invoice.base_amount }];
  invoice.items.forEach((it) => {
    rows.push({
      description: `${it.description}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
      amount: it.line_total,
    });
  });
  if (parseFloat(invoice.discount) > 0) {
    rows.push({ description: "Discount", amount: -invoice.discount, isDiscount: true });
  }

  drawTable(doc, {
    x: margin,
    width: contentWidth,
    columns: [
      { label: "Item", value: (r) => r.description, width: contentWidth * 0.7 },
      {
        label: "Amount",
        value: (r) => `${r.isDiscount ? "-" : ""}${money(Math.abs(r.amount))}`,
        width: contentWidth * 0.3,
        align: "right",
      },
    ],
    rows,
    zebra: true,
  });

  const totalY = doc.y;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.text);
  doc.text("Total", margin, totalY, { lineBreak: false });
  doc.text(money(invoice.total_amount), margin, totalY, { width: contentWidth, align: "right" });
  doc.x = margin;
  doc.y = totalY + 18;

  doc.font("Helvetica").fontSize(9).fillColor(BRAND.text);
  doc.text(`Payment: ${invoice.payment_status}${invoice.payment_method ? ` — ${invoice.payment_method}` : ""}`, margin, doc.y);

  if (invoice.has_oil_change) {
    doc.fontSize(8.5).fillColor(BRAND.muted);
    doc.text(
      `Odometer: ${invoice.current_odometer != null ? `${invoice.current_odometer.toLocaleString()} km` : "—"}  —  Next service due at ${invoice.next_service_odometer != null ? `${invoice.next_service_odometer.toLocaleString()} km` : "—"}`,
      margin,
      doc.y,
    );
    doc.fillColor(BRAND.text);
  }

  if (invoice.notes) {
    doc.moveDown(0.5);
    doc.fontSize(8.5).fillColor(BRAND.muted);
    doc.text(invoice.notes, margin, doc.y, { width: contentWidth });
    doc.fillColor(BRAND.text);
  }

  doc.moveDown(1);
  doc.font("Helvetica-Oblique").fontSize(9).fillColor(BRAND.muted);
  doc.text("Thank you for choosing DriveWell!", margin, doc.y, { width: contentWidth, align: "center" });

  finalizeFooters(doc, { generatedBy: invoice.cashier_name || "DriveWell" });
  return doc;
}

module.exports = { buildInvoicePdf };
