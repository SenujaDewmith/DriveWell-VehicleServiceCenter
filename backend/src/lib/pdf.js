const PDFDocument = require("pdfkit");

// Matches the admin UI's brand palette (see admin_fd tailwind theme / recharts COLORS).
const BRAND = {
  dark: "#3E432E",
  accent: "#616F39",
  light: "#A7D129",
  text: "#1f2933",
  muted: "#6b7280",
  border: "#e2e5df",
  panel: "#f7f8f3",
};

function createReportDoc({ title, subtitle }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - margin * 2;

  doc.fillColor(BRAND.dark).font("Helvetica-Bold").fontSize(14)
    .text("DriveWell — Vehicle Service Management System", margin, margin);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.text).text(title, margin, doc.y + 2);
  if (subtitle) {
    doc.font("Helvetica").fontSize(8.5).fillColor(BRAND.muted).text(subtitle, margin, doc.y + 2);
  }
  doc.moveDown(0.6);
  doc.strokeColor(BRAND.border).lineWidth(1)
    .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor(BRAND.text);

  return { doc, margin, contentWidth };
}

function sectionTitle(doc, margin, text) {
  ensureSpace(doc, 20);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BRAND.text).text(text, margin, doc.y);
  doc.moveDown(0.4);
}

// Rows of labeled stat boxes, e.g. Total Revenue / Paid / Unpaid.
function drawKpiRow(doc, { x, width, stats }) {
  const gap = 10;
  const boxWidth = (width - gap * (stats.length - 1)) / stats.length;
  const boxHeight = 44;
  ensureSpace(doc, boxHeight + 12);
  const y = doc.y;

  stats.forEach((s, i) => {
    const bx = x + i * (boxWidth + gap);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 4).fillAndStroke(BRAND.panel, BRAND.border);
    doc.fillColor(BRAND.muted).font("Helvetica").fontSize(7.5)
      .text(s.label, bx + 8, y + 7, { width: boxWidth - 16 });
    doc.fillColor(BRAND.text).font("Helvetica-Bold").fontSize(12.5)
      .text(String(s.value), bx + 8, y + 20, { width: boxWidth - 16 });
  });

  doc.x = x;
  doc.y = y + boxHeight + 14;
}

// Bulleted callouts — the "why it matters" layer a screenshot can't produce.
function drawInsights(doc, margin, contentWidth, insights) {
  if (!insights.length) return;
  sectionTitle(doc, margin, "Key Insights");
  const bulletWidth = 12;
  insights.forEach((line) => {
    ensureSpace(doc, 14);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.accent)
      .text("•", margin, y, { width: bulletWidth, lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.text)
      .text(line, margin + bulletWidth, y, { width: contentWidth - bulletWidth });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.5);
}

// Simple vertical bar chart drawn with vector primitives — no rasterization.
function drawBarChart(doc, { x, width, height = 130, data, labelKey, valueKey, color = BRAND.light, valueFormatter = (v) => String(v) }) {
  ensureSpace(doc, height + 20);
  const y = doc.y;
  const axisY = y + height - 16;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const gap = 6;
  const barWidth = Math.min(40, (width - gap * (data.length - 1)) / Math.max(data.length, 1));
  const usedWidth = data.length * barWidth + (data.length - 1) * gap;
  const startX = x + (width - usedWidth) / 2;

  doc.strokeColor(BRAND.border).lineWidth(1).moveTo(x, axisY).lineTo(x + width, axisY).stroke();

  data.forEach((d, i) => {
    const value = Number(d[valueKey]) || 0;
    const barHeight = Math.max((value / max) * (height - 32), value > 0 ? 2 : 0);
    const bx = startX + i * (barWidth + gap);
    doc.rect(bx, axisY - barHeight, barWidth, barHeight).fill(color);
    doc.fillColor(BRAND.muted).font("Helvetica").fontSize(6.5)
      .text(String(d[labelKey]), bx - 4, axisY + 4, { width: barWidth + 8, align: "center" });
    doc.fillColor(BRAND.text).font("Helvetica").fontSize(6.5)
      .text(valueFormatter(value), bx - 10, axisY - barHeight - 9, { width: barWidth + 20, align: "center" });
  });

  doc.fillColor(BRAND.text);
  doc.x = x;
  doc.y = y + height + 10;
}

// Manual paginated table (pdfkit has no built-in autoTable).
function drawTable(doc, { x, width, columns, rows, zebra = true }) {
  const rowHeight = 20;
  const headerHeight = 22;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawHeaderRow = (y) => {
    doc.rect(x, y, width, headerHeight).fill(BRAND.accent);
    let cx = x;
    columns.forEach((col) => {
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8)
        .text(col.label, cx + 6, y + 7, { width: col.width - 12, align: col.align || "left" });
      cx += col.width;
    });
    doc.fillColor(BRAND.text);
    return y + headerHeight;
  };

  ensureSpace(doc, headerHeight + rowHeight);
  let y = drawHeaderRow(doc.y);

  rows.forEach((row, i) => {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawHeaderRow(y);
    }
    if (zebra && i % 2 === 1) {
      doc.rect(x, y, width, rowHeight).fill(BRAND.panel);
      doc.fillColor(BRAND.text);
    }
    let cx = x;
    columns.forEach((col) => {
      doc.font("Helvetica").fontSize(8).fillColor(BRAND.text)
        .text(String(col.value(row) ?? "—"), cx + 6, y + 6, { width: col.width - 12, align: col.align || "left" });
      cx += col.width;
    });
    doc.strokeColor(BRAND.border).lineWidth(0.5).moveTo(x, y + rowHeight).lineTo(x + width, y + rowHeight).stroke();
    y += rowHeight;
  });

  doc.x = x;
  doc.y = y + 12;
}

function ensureSpace(doc, needed) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottomLimit) doc.addPage();
}

// Footer needs the final page count, only known once content is fully laid
// out — so it's written in a second pass over the buffered pages.
function finalizeFooters(doc, { generatedBy }) {
  const range = doc.bufferedPageRange();
  const generatedLine = `Generated by ${generatedBy || "system"} on ${new Date().toLocaleString("en-LK")}`;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const margin = doc.page.margins.left;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Drawing inside the bottom margin would otherwise make pdfkit think the
    // text overflows the page and silently insert a blank page to hold it.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.fillColor(BRAND.muted).font("Helvetica").fontSize(7.5);
    doc.text(generatedLine, margin, pageHeight - 26, { lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, pageWidth - margin - 120, pageHeight - 26, {
      width: 120,
      align: "right",
      lineBreak: false,
    });
    doc.fillColor(BRAND.text);

    doc.page.margins.bottom = originalBottomMargin;
  }
}

function sendPdf(res, doc, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}

module.exports = {
  BRAND,
  createReportDoc,
  sectionTitle,
  drawKpiRow,
  drawInsights,
  drawBarChart,
  drawTable,
  ensureSpace,
  finalizeFooters,
  sendPdf,
};
