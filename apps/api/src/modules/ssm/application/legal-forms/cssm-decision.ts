import {
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawParagraph,
  drawTable,
  FORM_MARGIN,
  formatRoDate,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type CssmDecisionInput = {
  employerName: string;
  cui?: string | null;
  headquarters?: string | null;
  committeeName: string;
  decisionNumber?: string | null;
  decisionDate?: Date | null;
  constitutedAt?: Date | null;
  notes?: string | null;
  members: Array<{
    fullName: string;
    role: string;
    functionTitle?: string | null;
    appointedAt?: Date | null;
    termEndsAt?: Date | null;
    active: boolean;
  }>;
};

export function renderCssmDecision(input: CssmDecisionInput): Promise<Buffer> {
  const width = 523;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006 art. 18–22  ·  HG nr. 1.425/2006 art. 66–70",
      "DECIZIE DE NUMIRE CSSM",
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
    const nrEnd = drawLabeledValue(
      doc,
      "NR. DECIZIE",
      dash(input.decisionNumber),
      FORM_MARGIN,
      y,
      width / 2 - 6
    );
    const dateEnd = drawLabeledValue(
      doc,
      "DATA DECIZIEI",
      dash(formatRoDate(input.decisionDate)),
      FORM_MARGIN + width / 2 + 6,
      y,
      width / 2 - 6
    );
    doc.y = Math.max(nrEnd, dateEnd);
    if (input.constitutedAt) {
      y = doc.y;
      y = drawLabeledValue(doc, "DATA CONSTITUIRII", dash(formatRoDate(input.constitutedAt)), FORM_MARGIN, y, width);
      doc.y = y;
    }

    drawParagraph(
      doc,
      "În temeiul art. 18 din Legea nr. 319/2006 și al art. 66–70 din HG nr. 1.425/2006, se constituie / se actualizează Comitetul de Securitate și Sănătate în Muncă, cu următoarea componență:"
    );
    doc.moveDown(0.15);
    doc.font(PdfFont.bold).fontSize(9).text("Componența CSSM");
    doc.moveDown(0.15);
    const activeMembers = input.members.filter((member) => member.active);
    drawTable(
      doc,
      [
        { header: "Nume și prenume", width: 170 },
        { header: "Rol în CSSM", width: 145 },
        { header: "Funcția", width: 118 },
        { header: "Numit la", width: 90 }
      ],
      activeMembers.map((member) => [
        member.fullName,
        member.role,
        member.functionTitle ?? "",
        formatRoDate(member.appointedAt) || ""
      ]),
      { minRows: Math.max(6, activeMembers.length) }
    );

    if (input.notes?.trim()) {
      doc.font(PdfFont.bold).fontSize(9).text("Mențiuni");
      drawParagraph(doc, input.notes);
    }

    drawFooterNote(
      doc,
      "Decizia de numire se păstrează în dosarul CSSM și în biblioteca de documente SSM (tip DECISION), pentru control ITM. Componența se actualizează la fiecare modificare a membrilor."
    );
  });
}
