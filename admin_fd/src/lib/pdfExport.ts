import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

export async function exportElementToPdf(elementId: string, filename: string, title: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const headerHeight = 18;
  const usableWidth = pageWidth - margin * 2;

  // Full image scaled to page width, in mm
  const fullImgHeightMm = (canvas.height * usableWidth) / canvas.width;
  // How many source canvas pixels correspond to one mm at this scale
  const pxPerMm = canvas.width / usableWidth;

  const firstPageBodyHeightMm = pageHeight - margin * 2 - headerHeight;
  const otherPageBodyHeightMm = pageHeight - margin * 2;

  let renderedMm = 0;
  let page = 0;

  while (renderedMm < fullImgHeightMm) {
    const bodyHeightMm = page === 0 ? firstPageBodyHeightMm : otherPageBodyHeightMm;
    const sliceHeightMm = Math.min(bodyHeightMm, fullImgHeightMm - renderedMm);
    const sourceYPx = Math.round(renderedMm * pxPerMm);
    const sliceHeightPx = Math.min(canvas.height - sourceYPx, Math.round(sliceHeightMm * pxPerMm));

    if (sliceHeightPx <= 0) break;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(canvas, 0, sourceYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    }
    const sliceImg = sliceCanvas.toDataURL("image/png");

    if (page > 0) pdf.addPage();

    if (page === 0) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("DriveWell — Vehicle Service Management System", margin, margin);
      pdf.setFontSize(11);
      pdf.text(title, margin, margin + 7);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 12);
    }

    const yPosition = page === 0 ? margin + headerHeight : margin;
    pdf.addImage(sliceImg, "PNG", margin, yPosition, usableWidth, sliceHeightMm);

    renderedMm += sliceHeightMm;
    page += 1;
    if (page > 25) break; // safety cap
  }

  pdf.save(filename);
}