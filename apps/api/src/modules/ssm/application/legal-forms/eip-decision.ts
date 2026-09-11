import {
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawParagraph,
  drawSignatureBox,
  drawTable,
  FORM_MARGIN,
  formatRoDate,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type EipDecisionNormLine = {
  code: string;
  name: string;
  requiredQuantity: number;
  lifetimeDays: number;
  replacementRule?: string | null;
};

export type EipDecisionAllocatedLine = {
  code: string;
  name: string;
  quantity: number;
  movementDate: Date;
  replacementDueAt?: Date | null;
  signed: boolean;
};

export type EipDecisionInput = {
  employerName: string;
  cui?: string | null;
  headquarters?: string | null;
  employeeName: string;
  jobPositionName?: string | null;
  departmentName?: string | null;
  worksiteName?: string | null;
  generatedAt: Date;
  norms: EipDecisionNormLine[];
  allocated: EipDecisionAllocatedLine[];
};

export function renderEipDecision(input: EipDecisionInput): Promise<Buffer> {
  const width = 523;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006 art. 13  ·  HG nr. 1.048/2006  ·  HG nr. 1.425/2006",
      "DECIZIE DE ACORDARE EIP",
      "Echipamente individuale de protecție — copie pentru dosarul angajatului"
    );

    let y = doc.y;
    y = drawLabeledValue(doc, "ANGAJATOR", dash(input.employerName), FORM_MARGIN, y, width);
    y = drawLabeledValue(
      doc,
      "CUI / SEDIU",
      [input.cui ? `CUI ${input.cui}` : "", input.headquarters].filter(Boolean).join(" — ") || "—",
      FORM_MARGIN,
      y,
      width
    );
    y = drawLabeledValue(doc, "ANGAJAT", dash(input.employeeName), FORM_MARGIN, y, width);
    const jobEnd = drawLabeledValue(doc, "FUNCȚIE / POST", dash(input.jobPositionName), FORM_MARGIN, y, width / 2 - 6);
    const deptEnd = drawLabeledValue(
      doc,
      "DEPARTAMENT",
      dash(input.departmentName),
      FORM_MARGIN + width / 2 + 6,
      y,
      width / 2 - 6
    );
    doc.y = Math.max(jobEnd, deptEnd);
    y = doc.y;
    const siteEnd = drawLabeledValue(doc, "PUNCT DE LUCRU", dash(input.worksiteName), FORM_MARGIN, y, width / 2 - 6);
    const dateEnd = drawLabeledValue(
      doc,
      "DATA DECIZIEI",
      dash(formatRoDate(input.generatedAt)),
      FORM_MARGIN + width / 2 + 6,
      y,
      width / 2 - 6
    );
    doc.y = Math.max(siteEnd, dateEnd);
    doc.moveDown(0.2);

    drawParagraph(
      doc,
      `În temeiul art. 13 din Legea nr. 319/2006 și al HG nr. 1.048/2006 privind utilizarea echipamentelor individuale de protecție, se dispune acordarea EIP pentru ${input.employeeName}, conform normativului postului ${dash(input.jobPositionName)}.`
    );
    doc.moveDown(0.15);
    doc.font(PdfFont.bold).fontSize(9).text("1. EIP prevăzut prin normativul postului");
    doc.moveDown(0.12);
    drawTable(
      doc,
      [
        { header: "Cod", width: 70 },
        { header: "Denumire EIP", width: 175 },
        { header: "Cant.", width: 48, align: "center" },
        { header: "Durată (zile)", width: 80, align: "center" },
        { header: "Regulă de înlocuire", width: 150 }
      ],
      input.norms.length
        ? input.norms.map((line) => [
            line.code,
            line.name,
            String(line.requiredQuantity),
            String(line.lifetimeDays),
            line.replacementRule ?? "La uzură / scadență"
          ])
        : [["", "Nu există normativ EIP pentru postul angajatului.", "", "", ""]],
      { minRows: Math.max(4, input.norms.length) }
    );

    doc.font(PdfFont.bold).fontSize(9).text("2. EIP deja distribuit angajatului");
    doc.moveDown(0.12);
    drawTable(
      doc,
      [
        { header: "Cod", width: 70 },
        { header: "Denumire EIP", width: 155 },
        { header: "Cant.", width: 48, align: "center" },
        { header: "Data", width: 80 },
        { header: "Înlocuire", width: 80 },
        { header: "Semnat", width: 90, align: "center" }
      ],
      input.allocated.length
        ? input.allocated.map((line) => [
            line.code,
            line.name,
            String(line.quantity),
            formatRoDate(line.movementDate),
            line.replacementDueAt ? formatRoDate(line.replacementDueAt) : "—",
            line.signed ? "Da" : "Nu"
          ])
        : [["", "Nu există distribuții EIP înregistrate.", "", "", "", ""]],
      { minRows: Math.max(3, input.allocated.length) }
    );

    drawParagraph(
      doc,
      "Angajatul are obligația să utilizeze, să întrețină și să restituie EIP-ul primit, să semnaleze uzura sau defectele și să solicite înlocuirea la scadență. Prezenta decizie se arhivează în dosarul digital SSM al angajatului."
    );

    const sigY = doc.y + 10;
    const boxW = (width - 24) / 3;
    const a = drawSignatureBox(doc, "Angajator", null, null, FORM_MARGIN, sigY, boxW);
    const b = drawSignatureBox(doc, "Responsabil SSM", null, null, FORM_MARGIN + boxW + 12, sigY, boxW);
    const c = drawSignatureBox(doc, "Angajat (luare la cunoștință)", null, null, FORM_MARGIN + (boxW + 12) * 2, sigY, boxW);
    doc.y = Math.max(a, b, c);

    drawFooterNote(
      doc,
      "Copia deciziei de acordare EIP însoțește dosarul digital al angajatului (control ITM). Documentul este generat automat din normativul postului și evidența de distribuire."
    );
  });
}
