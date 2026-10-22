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
  PdfDoc,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type SsmConventionPdfParty = {
  isHost: boolean;
  companyName: string;
  cui?: string | null;
  representativeName?: string | null;
  representativeFunction?: string | null;
  ssmContactName?: string | null;
  ssmContactPhone?: string | null;
  ssmContactEmail?: string | null;
  workersCount?: number | null;
  obligations?: string | null;
  signature?: string | null;
  signedAt?: Date | null;
};

export type SsmConventionPdfInput = {
  number: string;
  title: string;
  status: string;
  worksiteName: string;
  worksiteAddress?: string | null;
  activityDescription?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  coordinatorName?: string | null;
  coordinatorFunction?: string | null;
  coordinatorEmail?: string | null;
  sharedRisks?: string | null;
  preventionMeasures?: string | null;
  emergencyArrangements?: string | null;
  trainingArrangements?: string | null;
  eipArrangements?: string | null;
  notes?: string | null;
  parties: SsmConventionPdfParty[];
};

function chapter(doc: PdfDoc, index: number, title: string, body?: string | null) {
  ensureSpace(doc, 40);
  doc.moveDown(0.3);
  doc.font(PdfFont.bold).fontSize(9.5).text(`Art. ${index}. ${title}`);
  doc.moveDown(0.1);
  drawParagraph(doc, body ?? "");
}

export function renderSsmConvention(input: SsmConventionPdfInput): Promise<Buffer> {
  const width = 523;
  const half = width / 2 - 6;
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006, art. 13 lit. e) și art. 14  ·  HG nr. 1.425/2006  ·  HG nr. 300/2006 (șantiere)",
      "CONVENȚIE PRIVIND SECURITATEA ȘI SĂNĂTATEA ÎN MUNCĂ",
      `Nr. ${input.number} — ${input.title}`
    );

    let y = doc.y;
    const siteEnd = drawLabeledValue(doc, "LOC DE MUNCĂ COMUN (ȘANTIER / DEPOZIT)", dash(input.worksiteName), FORM_MARGIN, y, half);
    const addressEnd = drawLabeledValue(doc, "ADRESĂ", dash(input.worksiteAddress), FORM_MARGIN + half + 12, y, half);
    y = Math.max(siteEnd, addressEnd);
    const startEnd = drawLabeledValue(doc, "VALABILĂ DIN", formatRoDate(input.startsAt), FORM_MARGIN, y, half);
    const endEnd = drawLabeledValue(
      doc,
      "VALABILĂ PÂNĂ LA",
      input.endsAt ? formatRoDate(input.endsAt) : "Pe durata lucrărilor",
      FORM_MARGIN + half + 12,
      y,
      half
    );
    y = Math.max(startEnd, endEnd);
    const coordinator = [input.coordinatorName, input.coordinatorFunction].filter(Boolean).join(" — ");
    const coordEnd = drawLabeledValue(doc, "COORDONATOR SSM AL LOCULUI COMUN", dash(coordinator), FORM_MARGIN, y, half);
    const coordMailEnd = drawLabeledValue(doc, "CONTACT COORDONATOR", dash(input.coordinatorEmail), FORM_MARGIN + half + 12, y, half);
    doc.y = Math.max(coordEnd, coordMailEnd);
    doc.x = FORM_MARGIN;

    doc.font(PdfFont.bold).fontSize(9).text("Părțile convenției");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Rol", width: 70 },
        { header: "Societate / CUI", width: 140 },
        { header: "Reprezentant legal", width: 110 },
        { header: "Persoană contact SSM", width: 143 },
        { header: "Lucrători", width: 60, align: "center" }
      ],
      input.parties.map((party) => [
        party.isHost ? "Beneficiar / gazdă" : "Executant / terț",
        [party.companyName, party.cui ? `CUI ${party.cui}` : ""].filter(Boolean).join("\n"),
        [party.representativeName, party.representativeFunction].filter(Boolean).join(", "),
        [party.ssmContactName, party.ssmContactPhone, party.ssmContactEmail].filter(Boolean).join(" · "),
        party.workersCount != null ? String(party.workersCount) : ""
      ]),
      { minRows: Math.max(2, input.parties.length) }
    );
    doc.x = FORM_MARGIN;

    chapter(doc, 1, "Obiectul convenției și activitățile desfășurate", input.activityDescription);
    chapter(doc, 2, "Riscuri comune și riscuri induse între angajatori", input.sharedRisks);
    chapter(doc, 3, "Măsuri de prevenire și protecție convenite", input.preventionMeasures);
    chapter(doc, 4, "Instruire, informare și acces pe locul de muncă comun", input.trainingArrangements);
    chapter(doc, 5, "Echipament individual de protecție", input.eipArrangements);
    chapter(doc, 6, "Prim ajutor, stingerea incendiilor și evacuare (PSI)", input.emergencyArrangements);

    let article = 7;
    const withObligations = input.parties.filter((party) => party.obligations?.trim());
    if (withObligations.length) {
      ensureSpace(doc, 40);
      doc.moveDown(0.3);
      doc.font(PdfFont.bold).fontSize(9.5).text(`Art. ${article}. Obligațiile specifice ale părților`);
      for (const party of withObligations) {
        doc.font(PdfFont.bold).fontSize(8.5).text(party.companyName);
        drawParagraph(doc, party.obligations ?? "");
      }
      article += 1;
    }
    chapter(
      doc,
      article,
      "Dispoziții finale",
      [
        "Fiecare angajator răspunde pentru securitatea și sănătatea propriilor lucrători. Părțile cooperează la " +
          "aplicarea măsurilor SSM, își coordonează acțiunile și se informează reciproc despre riscurile profesionale, " +
          "accidentele și incidentele produse pe locul de muncă comun.",
        input.notes?.trim() ?? ""
      ]
        .filter(Boolean)
        .join("\n")
    );

    doc.moveDown(0.5);
    const col = width / 2;
    for (let index = 0; index < input.parties.length; index += 2) {
      ensureSpace(doc, 110);
      const rowY = doc.y;
      const ends: number[] = [];
      for (let offset = 0; offset < 2; offset += 1) {
        const party = input.parties[index + offset];
        if (!party) continue;
        const label = [party.companyName, party.representativeName].filter(Boolean).join(" — prin ");
        ends.push(
          drawSignatureBox(doc, label, party.signedAt, party.signature, FORM_MARGIN + offset * col, rowY, col - 8)
        );
      }
      doc.y = Math.max(...ends);
      doc.x = FORM_MARGIN;
    }

    drawFooterNote(
      doc,
      `Convenție generată din platforma SSM · stare: ${input.status}. Documentul semnat se păstrează în dosarul ` +
        "locului de muncă și se prezintă la controalele ITM / ISU."
    );
  });
}
