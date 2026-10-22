import {
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawParagraph,
  drawSignatureBox,
  drawTable,
  ensureSpace,
  FORM_MARGIN,
  formatRoDate,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type ExposureSheetInput = {
  employerName?: string | null;
  employerCui?: string | null;
  worksiteName?: string | null;
  departmentName?: string | null;
  employeeName: string;
  hireDate?: Date | string | null;
  jobPositionName?: string | null;
  corCode?: string | null;
  activityDescription?: string | null;
  issuedAt: Date;
  triggerLabel: string;
  assessment: {
    title: string;
    versionNumber: number;
    updateReason?: string | null;
    effectiveFrom?: Date | string | null;
    riskLevel?: number | null;
  } | null;
  factors: Array<{ name: string; probability?: number | null; severity?: number | null; score?: number | null }>;
  measures: Array<{ title: string; owner?: string | null; dueAt?: string | null }>;
  eipItems: string[];
  employeeSignature?: string | null;
  employeeSignedAt?: Date | null;
  assessorName?: string | null;
  assessorFunction?: string | null;
  assessorSignature?: string | null;
  assessorSignedAt?: Date | null;
};

function riskBand(score?: number | null): string {
  if (score == null) return "";
  if (score >= 15) return "Ridicat";
  if (score >= 8) return "Mediu";
  return "Scăzut";
}

export function renderExposureSheet(input: ExposureSheetInput): Promise<Buffer> {
  const width = 523;
  const half = width / 2 - 6;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006  ·  HG nr. 1.425/2006  ·  HG nr. 355/2007",
      "FIȘĂ DE EXPUNERE LA RISCURI PROFESIONALE",
      input.assessment
        ? `Evaluare de risc: ${input.assessment.title} — versiunea ${input.assessment.versionNumber}`
        : "Fără evaluare de risc activă pentru post"
    );

    let y = doc.y;
    const employerEnd = drawLabeledValue(doc, "ANGAJATOR", dash(input.employerName), FORM_MARGIN, y, half);
    const cuiEnd = drawLabeledValue(doc, "CUI", dash(input.employerCui), FORM_MARGIN + half + 12, y, half);
    y = Math.max(employerEnd, cuiEnd);
    const worksiteEnd = drawLabeledValue(doc, "PUNCT DE LUCRU", dash(input.worksiteName), FORM_MARGIN, y, half);
    const departmentEnd = drawLabeledValue(doc, "DEPARTAMENT", dash(input.departmentName), FORM_MARGIN + half + 12, y, half);
    y = Math.max(worksiteEnd, departmentEnd);
    const nameEnd = drawLabeledValue(doc, "NUME ȘI PRENUME LUCRĂTOR", dash(input.employeeName), FORM_MARGIN, y, half);
    const hireEnd = drawLabeledValue(
      doc,
      "DATA ANGAJĂRII",
      dash(formatRoDate(input.hireDate)),
      FORM_MARGIN + half + 12,
      y,
      half
    );
    y = Math.max(nameEnd, hireEnd);
    const jobEnd = drawLabeledValue(doc, "POST / FUNCȚIE", dash(input.jobPositionName), FORM_MARGIN, y, half);
    const corEnd = drawLabeledValue(doc, "COD COR", dash(input.corCode), FORM_MARGIN + half + 12, y, half);
    y = Math.max(jobEnd, corEnd);
    const issuedEnd = drawLabeledValue(doc, "DATA EMITERII", formatRoDate(input.issuedAt), FORM_MARGIN, y, half);
    const triggerEnd = drawLabeledValue(doc, "MOTIV EMITERE", dash(input.triggerLabel), FORM_MARGIN + half + 12, y, half);
    doc.y = Math.max(issuedEnd, triggerEnd);
    doc.x = FORM_MARGIN;

    if (input.activityDescription?.trim()) {
      doc.font(PdfFont.bold).fontSize(9).text("Descrierea activității la postul de lucru");
      drawParagraph(doc, input.activityDescription);
      doc.moveDown(0.3);
    }

    if (input.assessment) {
      doc
        .font(PdfFont.regular)
        .fontSize(8)
        .text(
          [
            `Nivel global de risc: ${dash(input.assessment.riskLevel)}`,
            input.assessment.effectiveFrom ? `în vigoare din ${formatRoDate(input.assessment.effectiveFrom)}` : "",
            input.assessment.updateReason ? `motiv revizie: ${input.assessment.updateReason}` : ""
          ]
            .filter(Boolean)
            .join(" · ")
        );
      doc.moveDown(0.3);
    }

    doc.font(PdfFont.bold).fontSize(9).text("Factori de risc la care este expus lucrătorul");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Nr.", width: 30, align: "center" },
        { header: "Factor de risc", width: 283 },
        { header: "Probabilitate", width: 60, align: "center" },
        { header: "Gravitate", width: 55, align: "center" },
        { header: "Nivel risc", width: 95, align: "center" }
      ],
      input.factors.map((factor, index) => [
        String(index + 1),
        factor.name,
        factor.probability != null ? String(factor.probability) : "",
        factor.severity != null ? String(factor.severity) : "",
        factor.score != null ? `${factor.score} — ${riskBand(factor.score)}` : ""
      ]),
      { minRows: Math.max(3, input.factors.length) }
    );
    doc.x = FORM_MARGIN;

    doc.font(PdfFont.bold).fontSize(9).text("Măsuri de prevenire și protecție aplicabile");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Nr.", width: 30, align: "center" },
        { header: "Măsură", width: 323 },
        { header: "Responsabil", width: 100 },
        { header: "Termen", width: 70, align: "center" }
      ],
      input.measures.map((measure, index) => [
        String(index + 1),
        measure.title,
        measure.owner ?? "",
        measure.dueAt ? formatRoDate(measure.dueAt) : ""
      ]),
      { minRows: Math.max(3, input.measures.length) }
    );
    doc.x = FORM_MARGIN;

    doc.font(PdfFont.bold).fontSize(9).text("Echipament individual de protecție acordat conform normativului postului");
    drawParagraph(doc, input.eipItems.length ? input.eipItems.join("; ") : "Nu este prevăzut EIP pentru acest post.");
    doc.moveDown(0.4);

    ensureSpace(doc, 140);
    doc
      .font(PdfFont.regular)
      .fontSize(8.5)
      .text(
        "Subsemnatul declar că am fost informat asupra riscurilor profesionale specifice postului de lucru, " +
          "a măsurilor de prevenire și protecție aplicabile și a echipamentului individual de protecție pe care " +
          "am obligația să îl utilizez, conform evaluării de risc în vigoare.",
        { width, align: "justify" }
      );
    doc.moveDown(0.6);

    const col = width / 2;
    const rowY = doc.y;
    const left = drawSignatureBox(
      doc,
      `Lucrător: ${input.employeeName}`,
      input.employeeSignedAt,
      input.employeeSignature,
      FORM_MARGIN,
      rowY,
      col - 8
    );
    const assessorLabel = [input.assessorName, input.assessorFunction].filter(Boolean).join(" — ");
    const right = drawSignatureBox(
      doc,
      `Evaluator / responsabil SSM${assessorLabel ? `: ${assessorLabel}` : ""}`,
      input.assessorSignedAt,
      input.assessorSignature,
      FORM_MARGIN + col,
      rowY,
      col - 8
    );
    doc.y = Math.max(left, right);
    doc.x = FORM_MARGIN;

    drawFooterNote(
      doc,
      "Fișa se întocmește la angajare, la schimbarea postului și la fiecare revizie a evaluării de risc pentru post. " +
        "Exemplarul semnat se arhivează în dosarul digital SSM al lucrătorului."
    );
  });
}
