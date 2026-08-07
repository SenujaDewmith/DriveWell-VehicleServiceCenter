import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })
    : "—";

const fmtMoney = (v) =>
  v === null || v === undefined ? "—" : `LKR ${parseFloat(v).toLocaleString()}`;

// Vector-based PDF (real text + a real table via jspdf-autotable), matching the approach used
// for the admin-side vehicle service history report — crisp text and clean layout instead of a
// screenshot-based export.
export function generateInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DriveWell — Vehicle Service Management System", margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.text("Invoice", margin, y);
  y += 9;

  doc.setDrawColor(200);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(invoice.bookingRef ? `Invoice ${invoice.bookingRef}` : `Invoice #${invoice.invoiceId}`, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const vehicleLabel = [invoice.make, invoice.model].filter(Boolean).join(" ");
  doc.text(
    `${vehicleLabel}${invoice.plateNo ? ` (${invoice.plateNo})` : ""} — ${invoice.packageName ?? "—"}`,
    margin,
    y,
  );
  y += 5;
  doc.text(`Service date: ${fmtDate(invoice.serviceDate)}`, margin, y);
  y += 5;
  doc.text(`Payment status: ${invoice.paymentStatus ?? "—"}${invoice.paymentMethod ? ` (${invoice.paymentMethod})` : ""}`, margin, y);
  y += 8;

  if (invoice.hasOilChange) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Odometer at this service: ${invoice.currentOdometer != null ? `${invoice.currentOdometer.toLocaleString()} km` : "—"}  —  Next service due at: ${invoice.nextServiceOdometer != null ? `${invoice.nextServiceOdometer.toLocaleString()} km` : "—"}`,
      margin,
      y,
    );
    y += 8;
  }

  const rows = [[invoice.packageName ?? "—", "1", fmtMoney(invoice.baseAmount)]];
  invoice.items.forEach((item) => {
    rows.push([
      `${item.description}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
      String(item.quantity ?? 1),
      fmtMoney(item.line_total),
    ]);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Amount"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [97, 111, 57], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  const pageWidth = doc.internal.pageSize.getWidth();

  if (parseFloat(invoice.discount) > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Discount", margin, y);
    doc.text(`-${fmtMoney(invoice.discount)}`, pageWidth - margin, y, { align: "right" });
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", margin, y);
  doc.text(fmtMoney(invoice.totalAmount), pageWidth - margin, y, { align: "right" });
  y += 8;

  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(doc.splitTextToSize(invoice.notes, pageWidth - margin * 2), margin, y);
    doc.setTextColor(0);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(`Generated on ${fmtDate(invoice.generatedAt)}`, margin, pageHeight - 8);
  doc.setTextColor(0);

  doc.save(`drivewell-invoice-${invoice.bookingRef ?? invoice.invoiceId}.pdf`);
}
