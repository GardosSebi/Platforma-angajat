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
  formatRoDateTime,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type CssmMinutesInput = {
  employerName: string;
  cui?: string | null;
  headquarters?: string | null;
  committeeName: string;
  decisionNumber?: string | null;
  meetingTitle: string;
  kind: string;
  scheduledAt: Date;
  heldAt?: Date | null;
  location?: string | null;
  agenda?: string | null;
  minutesNumber: string;
  topics?: string | null;
  decisions?: string | null;
  nextMeetingAt?: Date | null;
  attendees: Array<{
    fullName: string;
    role?: string | null;
    present: boolean;
    signedAt?: Date | null;
    signature?: string | null;
  }>;
};

export function renderCssmMinutes(input: CssmMinutesInput): Promise<Buffer> {
  const width = 523;
  const present = input.attendees.filter((row) => row.present);
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006 art. 18–22  ·  HG nr. 1.425/2006 art. 66–80",
      "PROCES-VERBAL ȘEDINȚĂ CSSM",
      input.minutesNumber
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
    const committeeEnd = drawLabeledValue(doc, "COMITET", dash(input.committeeName), FORM_MARGIN, y, width / 2 - 6);
    const decisionEnd = drawLabeledValue(
      doc,
      "DECIZIE CONSTITUIRE",
      dash(input.decisionNumber),
      FORM_MARGIN + width / 2 + 6,
      y,
      width / 2 - 6
    );
    y = Math.max(committeeEnd, decisionEnd);
    y = drawLabeledValue(doc, "ȘEDINȚĂ", dash(input.meetingTitle), FORM_MARGIN, y, width);
    const typeEnd = drawLabeledValue(doc, "TIP", dash(input.kind), FORM_MARGIN, y, width / 3 - 4);
    const dateEnd = drawLabeledValue(
      doc,
      "DATA",
      dash(formatRoDateTime(input.heldAt ?? input.scheduledAt)),
      FORM_MARGIN + width / 3 + 4,
      y,
      width / 3 - 4
    );
    const locEnd = drawLabeledValue(
      doc,
      "LOCUL",
      dash(input.location),
      FORM_MARGIN + (width / 3) * 2 + 8,
      y,
      width / 3 - 4
    );
    doc.y = Math.max(typeEnd, dateEnd, locEnd);

    doc.font(PdfFont.bold).fontSize(9).text("Ordinea de zi");
    drawParagraph(doc, input.agenda || "—");

    doc.font(PdfFont.bold).fontSize(9).text("Prezență");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Nume", width: 180 },
        { header: "Rol", width: 150 },
        { header: "Prezent", width: 70, align: "center" },
        { header: "Semnătură", width: 123, align: "center" }
      ],
      input.attendees.map((row) => [
        row.fullName,
        row.role ?? "",
        row.present ? "Da" : "Nu",
        row.signedAt ? formatRoDate(row.signedAt) : ""
      ]),
      { minRows: Math.max(6, input.attendees.length) }
    );
    doc.font(PdfFont.regular).fontSize(8).text(`Prezenți: ${present.length} din ${input.attendees.length}.`);
    doc.moveDown(0.3);

    doc.font(PdfFont.bold).fontSize(9).text("Dezbaterea punctelor de pe ordinea de zi");
    drawParagraph(doc, input.topics || "—");

    doc.font(PdfFont.bold).fontSize(9).text("Hotărâri / măsuri adoptate");
    drawParagraph(doc, input.decisions || "—");

    if (input.nextMeetingAt) {
      doc.font(PdfFont.regular).fontSize(9).text(`Următoarea ședință: ${formatRoDateTime(input.nextMeetingAt)}.`);
      doc.moveDown(0.25);
    }

    doc.font(PdfFont.bold).fontSize(9).text("Semnături");
    doc.moveDown(0.2);
    const signers = present.slice(0, 6);
    let rowY = doc.y;
    const col = width / 3;
    signers.forEach((attendee, index) => {
      if (index > 0 && index % 3 === 0) {
        rowY += 78;
      }
      const x = FORM_MARGIN + (index % 3) * col;
      drawSignatureBox(
        doc,
        attendee.fullName,
        attendee.signedAt,
        attendee.signature,
        x,
        rowY,
        col - 8
      );
    });
    if (signers.length) {
      doc.y = rowY + 82;
    }

    drawFooterNote(
      doc,
      "Proces-verbal întocmit conform art. 73 HG nr. 1.425/2006. Documentul se păstrează la dosarul CSSM și este disponibil la control ITM."
    );
  });
}
