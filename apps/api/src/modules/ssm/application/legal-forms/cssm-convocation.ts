import {
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawParagraph,
  drawTable,
  FORM_MARGIN,
  formatRoDateTime,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type CssmConvocationInput = {
  employerName: string;
  cui?: string | null;
  headquarters?: string | null;
  committeeName: string;
  decisionNumber?: string | null;
  meetingTitle: string;
  kind: string;
  scheduledAt: Date;
  location?: string | null;
  agenda?: string | null;
  convenedAt?: Date | null;
  members: Array<{ fullName: string; role: string; functionTitle?: string | null }>;
};

export function renderCssmConvocation(input: CssmConvocationInput): Promise<Buffer> {
  const width = 523;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006 art. 18–22  ·  HG nr. 1.425/2006 art. 66–80",
      "CONVOCARE ȘEDINȚĂ CSSM",
      "Comitetul de Securitate și Sănătate în Muncă"
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
    y = drawLabeledValue(doc, "COMITET", dash(input.committeeName), FORM_MARGIN, y, width);
    if (input.decisionNumber) {
      y = drawLabeledValue(doc, "DECIZIE DE CONSTITUIRE", dash(input.decisionNumber), FORM_MARGIN, y, width);
    }
    doc.y = y;

    drawParagraph(
      doc,
      `În temeiul art. 18 din Legea nr. 319/2006 și al art. 71–73 din HG nr. 1.425/2006, vă convocăm la ședința ${input.kind.toLowerCase()} a CSSM.`
    );
    doc.moveDown(0.2);
    y = doc.y;
    const titleEnd = drawLabeledValue(doc, "TITLU ȘEDINȚĂ", dash(input.meetingTitle), FORM_MARGIN, y, width);
    const dateEnd = drawLabeledValue(
      doc,
      "DATA ȘI ORA",
      dash(formatRoDateTime(input.scheduledAt)),
      FORM_MARGIN,
      titleEnd,
      width / 2 - 6
    );
    const locEnd = drawLabeledValue(
      doc,
      "LOCUL",
      dash(input.location),
      FORM_MARGIN + width / 2 + 6,
      titleEnd,
      width / 2 - 6
    );
    doc.y = Math.max(dateEnd, locEnd);
    if (input.convenedAt) {
      doc.font(PdfFont.regular).fontSize(8).text(`Convocarea a fost emisă la ${formatRoDateTime(input.convenedAt)}.`);
    }
    doc.moveDown(0.25);
    doc.font(PdfFont.bold).fontSize(9).text("Ordinea de zi");
    drawParagraph(doc, input.agenda || "Va fi comunicată la deschiderea ședinței.");

    doc.font(PdfFont.bold).fontSize(9).text("Membri convocați");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Nume și prenume", width: 200 },
        { header: "Rol în CSSM", width: 180 },
        { header: "Funcția", width: 143 }
      ],
      input.members.map((member) => [member.fullName, member.role, member.functionTitle ?? ""]),
      { minRows: Math.max(6, input.members.length) }
    );

    drawFooterNote(
      doc,
      "Convocarea se transmite membrilor CSSM cu cel puțin 5 zile înainte de data ședinței (art. 71 HG 1.425/2006). Ședințele ordinare se țin cel puțin o dată pe trimestru."
    );
  });
}
