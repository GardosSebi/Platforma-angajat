import PDFDocument from "pdfkit";
import { applyUnicodeFonts, PdfFont } from "../../../../common/pdf-unicode-font";

export { PdfFont };

export type PdfDoc = InstanceType<typeof PDFDocument>;

export const FORM_MARGIN = 36;

export function formatRoDate(value?: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ro-RO");
}

export function formatRoDateTime(value?: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

export function looksEncrypted(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => /^[0-9a-f]+$/i.test(part));
}

export function decryptStoredCnp(decrypt: (payload: string) => string, stored?: string | null): string {
  if (!stored?.trim()) return "";
  if (!looksEncrypted(stored)) return stored.trim();
  try {
    return decrypt(stored);
  } catch {
    return "";
  }
}

/** Derives birth date from a Romanian CNP (S YY MM DD …). */
export function birthDateFromCnp(cnp: string): string {
  const digits = cnp.replace(/\D/g, "");
  if (digits.length < 7) return "";
  const sex = digits[0];
  const yy = Number(digits.slice(1, 3));
  const mm = Number(digits.slice(3, 5));
  const dd = Number(digits.slice(5, 7));
  if (!mm || mm > 12 || !dd || dd > 31) return "";
  let century = 1900;
  if (sex === "5" || sex === "6" || sex === "7" || sex === "8") century = 2000;
  else if (sex === "3" || sex === "4") century = 1800;
  return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${century + yy}`;
}

export function dash(value?: string | number | null): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}

export async function renderPdf(
  draw: (doc: PdfDoc) => void,
  options?: { layout?: "portrait" | "landscape"; margin?: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      layout: options?.layout ?? "portrait",
      margin: options?.margin ?? FORM_MARGIN
    });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    applyUnicodeFonts(doc);
    draw(doc);
    doc.end();
  });
}

export function pageBottom(doc: PdfDoc, margin = FORM_MARGIN): number {
  return doc.page.height - margin;
}

export function ensureSpace(doc: PdfDoc, needed: number, margin = FORM_MARGIN): void {
  if (doc.y + needed > pageBottom(doc, margin)) {
    doc.addPage();
  }
}

export function drawLegalBanner(
  doc: PdfDoc,
  citation: string,
  title: string,
  subtitle?: string
): void {
  const x = FORM_MARGIN;
  const width = doc.page.width - FORM_MARGIN * 2;
  doc.font(PdfFont.regular).fontSize(8).fillColor("#333").text(citation, x, FORM_MARGIN, {
    width,
    align: "center"
  });
  doc.moveDown(0.25);
  doc.font(PdfFont.bold).fontSize(13).fillColor("#000").text(title, { align: "center", width });
  if (subtitle) {
    doc.font(PdfFont.regular).fontSize(10).text(subtitle, { align: "center", width });
  }
  doc.moveDown(0.4);
  const y = doc.y;
  doc.moveTo(x, y).lineTo(x + width, y).strokeColor("#000").lineWidth(1).stroke();
  doc.y = y + 8;
}

export function drawFooterNote(doc: PdfDoc, note: string): void {
  ensureSpace(doc, 28);
  doc.moveDown(0.6);
  doc.font(PdfFont.regular).fontSize(7).fillColor("#444").text(note, {
    width: doc.page.width - FORM_MARGIN * 2,
    align: "left"
  });
  doc.fillColor("#000");
}

export function drawLabeledValue(
  doc: PdfDoc,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
): number {
  doc.font(PdfFont.bold).fontSize(8).text(label, x, y, { width, lineGap: 1 });
  const labelH = Math.max(10, doc.heightOfString(label, { width }));
  const display = value?.trim() ? value : " ";
  const valueY = y + labelH + 1;
  doc.font(PdfFont.regular).fontSize(9).text(display, x, valueY, { width, lineGap: 1 });
  const valueH = Math.max(11, doc.heightOfString(display, { width }));
  const lineY = valueY + valueH + 1;
  doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.4).stroke();
  return lineY + 6;
}

export type TableColumn = { header: string; width: number; align?: "left" | "center" };

export function drawTable(
  doc: PdfDoc,
  columns: TableColumn[],
  rows: string[][],
  options?: { minRows?: number; fontSize?: number; rowMinHeight?: number }
): void {
  const fontSize = options?.fontSize ?? 7;
  const minRows = options?.minRows ?? rows.length;
  const rowMinHeight = options?.rowMinHeight ?? 18;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const startX = FORM_MARGIN;
  const paddedRows = [...rows];
  while (paddedRows.length < minRows) paddedRows.push(columns.map(() => ""));

  const drawHeader = () => {
    const headerHeights = columns.map((col) =>
      doc.font(PdfFont.bold).fontSize(fontSize).heightOfString(col.header, { width: col.width - 4 }) + 8
    );
    const headerHeight = Math.max(22, ...headerHeights);
    ensureSpace(doc, headerHeight + 8);
    let x = startX;
    const y = doc.y;
    doc.rect(startX, y, tableWidth, headerHeight).lineWidth(0.6).stroke();
    columns.forEach((col) => {
      doc.font(PdfFont.bold).fontSize(fontSize).text(col.header, x + 2, y + 3, {
        width: col.width - 4,
        align: col.align ?? "center"
      });
      x += col.width;
    });
    x = startX;
    columns.forEach((col) => {
      doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
      x += col.width;
    });
    doc.y = y + headerHeight;
  };

  drawHeader();

  paddedRows.forEach((row) => {
    const cellHeights = columns.map((col, index) => {
      const text = row[index] ?? "";
      return Math.max(
        rowMinHeight,
        doc.font(PdfFont.regular).fontSize(fontSize).heightOfString(text || " ", { width: col.width - 4 }) + 6
      );
    });
    const height = Math.max(...cellHeights, rowMinHeight);
    if (doc.y + height > pageBottom(doc)) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    doc.rect(startX, y, tableWidth, height).lineWidth(0.4).stroke();
    let x = startX;
    columns.forEach((col, index) => {
      doc.font(PdfFont.regular).fontSize(fontSize).text(row[index] ?? "", x + 2, y + 3, {
        width: col.width - 4,
        align: col.align ?? "left"
      });
      doc.moveTo(x, y).lineTo(x, y + height).stroke();
      x += col.width;
    });
    doc.y = y + height;
  });
  doc.moveDown(0.4);
}

export function drawChapter(doc: PdfDoc, letter: string, title: string): void {
  ensureSpace(doc, 28);
  doc.moveDown(0.35);
  doc.font(PdfFont.bold).fontSize(10).text(`${letter}) ${title}`);
  doc.moveDown(0.12);
  doc.font(PdfFont.regular).fontSize(9);
}

export function drawParagraph(doc: PdfDoc, text: string): void {
  ensureSpace(doc, 24);
  doc.font(PdfFont.regular).fontSize(9).text(text?.trim() ? text : "—", {
    width: doc.page.width - FORM_MARGIN * 2,
    align: "justify",
    lineGap: 1.5
  });
}

export function drawSignatureBox(
  doc: PdfDoc,
  label: string,
  signedAt: Date | null | undefined,
  signatureData: string | null | undefined,
  x: number,
  y: number,
  width: number
): number {
  doc.font(PdfFont.bold).fontSize(7).text(label, x, y, { width, align: "center" });
  let nextY = y + 12;
  const dateLabel = signedAt ? formatRoDate(signedAt) : "";
  if (signatureData?.startsWith("data:image")) {
    try {
      const base64 = signatureData.split(",")[1];
      if (base64) {
        doc.image(Buffer.from(base64, "base64"), x + 8, nextY, { width: width - 16, height: 36, fit: [width - 16, 36] });
        nextY += 40;
      }
    } catch {
      nextY += 36;
    }
  } else {
    nextY += 28;
    doc.moveTo(x + 8, nextY).lineTo(x + width - 8, nextY).lineWidth(0.4).stroke();
    nextY += 4;
  }
  doc.font(PdfFont.regular).fontSize(7).text(dateLabel || " ", x, nextY, { width, align: "center" });
  return nextY + 12;
}
