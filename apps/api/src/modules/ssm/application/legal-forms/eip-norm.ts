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

export type EipNormLine = {
  code: string;
  name: string;
  requiredQuantity: number;
  lifetimeDays: number;
  replacementRule?: string | null;
};

export type EipNormDocumentInput = {
  employerName: string;
  cui?: string | null;
  headquarters?: string | null;
  jobPositionName: string;
  jobPositionCode?: string | null;
  generatedAt: Date;
  lines: EipNormLine[];
};

export function renderEipNormDocument(input: EipNormDocumentInput): Promise<Buffer> {
  const width = 523;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006 art. 13  ·  HG nr. 1.048/2006  ·  HG nr. 1.425/2006",
      "NORMATIV DE ACORDARE EIP",
      "Echipamente individuale de protecție pe post de lucru"
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
    const jobEnd = drawLabeledValue(doc, "POST DE LUCRU", dash(input.jobPositionName), FORM_MARGIN, y, width / 2 - 6);
    const codeEnd = drawLabeledValue(
      doc,
      "COD POST",
      dash(input.jobPositionCode),
      FORM_MARGIN + width / 2 + 6,
      y,
      width / 2 - 6
    );
    doc.y = Math.max(jobEnd, codeEnd);
    doc.font(PdfFont.regular).fontSize(8).text(`Document generat la ${formatRoDate(input.generatedAt)}.`);
    doc.moveDown(0.3);

    drawParagraph(
      doc,
      "Prezentul normativ stabilește echipamentele individuale de protecție care se acordă obligatoriu titularilor postului, cantitatea, durata de viață și regula de înlocuire, conform evaluării riscurilor și legislației SSM în vigoare."
    );
    doc.moveDown(0.15);
    doc.font(PdfFont.bold).fontSize(9).text("Echipamente prevăzute pentru post");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Cod", width: 70 },
        { header: "Denumire EIP", width: 175 },
        { header: "Cant.", width: 48, align: "center" },
        { header: "Durată (zile)", width: 80, align: "center" },
        { header: "Regulă de înlocuire", width: 150 }
      ],
      input.lines.length
        ? input.lines.map((line) => [
            line.code,
            line.name,
            String(line.requiredQuantity),
            String(line.lifetimeDays),
            line.replacementRule ?? "La uzură / scadență"
          ])
        : [["", "Nu există EIP normat pentru acest post.", "", "", ""]],
      { minRows: Math.max(6, input.lines.length) }
    );

    drawParagraph(
      doc,
      "Lucrătorul este obligat să utilizeze EIP-ul acordat pe toată durata activității care impune purtarea acestuia. Responsabilul SSM actualizează normativul la modificarea postului, a riscurilor sau a legislației aplicabile."
    );

    const sigY = doc.y + 12;
    const boxW = (width - 16) / 2;
    const leftEnd = drawSignatureBox(doc, "Angajator / conducere", null, null, FORM_MARGIN, sigY, boxW);
    const rightEnd = drawSignatureBox(
      doc,
      "Responsabil SSM",
      null,
      null,
      FORM_MARGIN + boxW + 16,
      sigY,
      boxW
    );
    doc.y = Math.max(leftEnd, rightEnd);

    drawFooterNote(
      doc,
      "Normativul de acordare EIP pe post face parte din documentația SSM obligatorie și se păstrează în registrul de documente, cu versionare la fiecare actualizare a normării."
    );
  });
}
