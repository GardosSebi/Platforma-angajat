import {
  drawFooterNote,
  drawLegalBanner,
  drawTable,
  ensureSpace,
  FORM_MARGIN,
  formatRoDate,
  formatRoDateTime,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type IsuSummaryWorksite = {
  code: string;
  name: string;
  legalEntityName: string | null;
  score: number;
  traffic: "GREEN" | "YELLOW" | "RED";
  documents: { instructions: boolean; evacuationPlan: boolean; intervention: boolean; count: number };
  equipment: { total: number; ok: number; dueSoon: number; overdue: number; neverVerified: number };
  drills: { lastConductedAt: string | null; nextDueAt: string | null; overdue: boolean; countLast12Months: number };
  personnel: { activeEmployees: number; trained: number; coveragePercent: number; untrained: Array<{ fullName: string }> };
  responsibles: Array<{ label: string; persons: string[] }>;
  gaps: string[];
  overdueEquipment: Array<{ code: string; name: string; location: string | null; nextDueAt: string | null }>;
};

export type IsuSummaryInput = {
  tenantName?: string | null;
  generatedAt: Date;
  generatedBy?: string | null;
  worksites: IsuSummaryWorksite[];
};

const TRAFFIC_LABEL: Record<IsuSummaryWorksite["traffic"], string> = {
  GREEN: "PREGĂTIT",
  YELLOW: "PARȚIAL",
  RED: "NEPREGĂTIT"
};

const yesNo = (value: boolean) => (value ? "DA" : "NU");

export function renderIsuControlSummary(input: IsuSummaryInput): Promise<Buffer> {
  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 307/2006 privind apărarea împotriva incendiilor  ·  OMAI nr. 163/2007  ·  OMAI nr. 712/2005",
      "PACHET CONTROL ISU — SITUAȚIA APĂRĂRII ÎMPOTRIVA INCENDIILOR",
      [input.tenantName, `generat ${formatRoDateTime(input.generatedAt)}`].filter(Boolean).join(" · ")
    );

    doc.font(PdfFont.bold).fontSize(9).text("Sinteză pe puncte de lucru");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Punct de lucru", width: 128 },
        { header: "Scor", width: 40, align: "center" },
        { header: "Stare", width: 65, align: "center" },
        { header: "Plan evacuare", width: 50, align: "center" },
        { header: "Stingătoare OK / total", width: 70, align: "center" },
        { header: "Ultima simulare", width: 65, align: "center" },
        { header: "Personal instruit PSI", width: 105, align: "center" }
      ],
      input.worksites.map((site) => [
        `${site.code} — ${site.name}`,
        `${site.score}%`,
        TRAFFIC_LABEL[site.traffic],
        yesNo(site.documents.evacuationPlan),
        `${site.equipment.ok + site.equipment.dueSoon} / ${site.equipment.total}`,
        site.drills.lastConductedAt ? formatRoDate(site.drills.lastConductedAt) : "—",
        `${site.personnel.trained} / ${site.personnel.activeEmployees} (${site.personnel.coveragePercent}%)`
      ]),
      { minRows: Math.max(1, input.worksites.length) }
    );
    doc.x = FORM_MARGIN;

    for (const site of input.worksites) {
      ensureSpace(doc, 160);
      doc.moveDown(0.5);
      doc
        .font(PdfFont.bold)
        .fontSize(10.5)
        .text(`${site.code} — ${site.name}${site.legalEntityName ? ` (${site.legalEntityName})` : ""}`);
      doc.font(PdfFont.regular).fontSize(8.5).text(`Scor pregătire control: ${site.score}% — ${TRAFFIC_LABEL[site.traffic]}`);
      doc.moveDown(0.25);

      drawTable(
        doc,
        [
          { header: "Cerință", width: 263 },
          { header: "Situație", width: 260 }
        ],
        [
          ["Instrucțiuni proprii PSI", yesNo(site.documents.instructions)],
          ["Plan de evacuare afișat / aprobat", yesNo(site.documents.evacuationPlan)],
          ["Plan de intervenție / organizare în situații de urgență", yesNo(site.documents.intervention)],
          [
            "Mijloace de stingere (stingătoare, hidranți, detecție)",
            `${site.equipment.total} total · ${site.equipment.ok} conforme · ${site.equipment.dueSoon} scadente ≤30 zile · ` +
              `${site.equipment.overdue} expirate · ${site.equipment.neverVerified} fără verificare`
          ],
          [
            "Exerciții de evacuare (simulări)",
            [
              `${site.drills.countLast12Months} în ultimele 12 luni`,
              site.drills.lastConductedAt ? `ultima: ${formatRoDate(site.drills.lastConductedAt)}` : "nicio simulare",
              site.drills.nextDueAt ? `următoarea: ${formatRoDate(site.drills.nextDueAt)}` : "",
              site.drills.overdue ? "SCADENȚĂ DEPĂȘITĂ" : ""
            ]
              .filter(Boolean)
              .join(" · ")
          ],
          [
            "Personal instruit PSI (instruire valabilă)",
            `${site.personnel.trained} din ${site.personnel.activeEmployees} angajați activi (${site.personnel.coveragePercent}%)`
          ],
          ...site.responsibles.map((row) => [row.label, row.persons.length ? row.persons.join(", ") : "NEDESEMNAT"])
        ],
        { fontSize: 7.5 }
      );
      doc.x = FORM_MARGIN;

      if (site.gaps.length) {
        ensureSpace(doc, 30);
        doc.font(PdfFont.bold).fontSize(9).fillColor("#a00").text("Neconformități de remediat înainte de control");
        doc.fillColor("#000").font(PdfFont.regular).fontSize(8.5);
        for (const gap of site.gaps) {
          ensureSpace(doc, 12);
          doc.text(`•  ${gap}`, FORM_MARGIN + 6);
        }
        doc.x = FORM_MARGIN;
        doc.moveDown(0.3);
      }

      if (site.overdueEquipment.length) {
        doc.font(PdfFont.bold).fontSize(8.5).text("Mijloace PSI cu verificarea expirată");
        doc.moveDown(0.1);
        drawTable(
          doc,
          [
            { header: "Cod", width: 80 },
            { header: "Denumire", width: 200 },
            { header: "Amplasament", width: 163 },
            { header: "Scadență", width: 80, align: "center" }
          ],
          site.overdueEquipment.map((item) => [
            item.code,
            item.name,
            item.location ?? "",
            item.nextDueAt ? formatRoDate(item.nextDueAt) : "—"
          ])
        );
        doc.x = FORM_MARGIN;
      }

      if (site.personnel.untrained.length) {
        ensureSpace(doc, 30);
        doc.font(PdfFont.bold).fontSize(8.5).text(`Personal fără instruire PSI valabilă (${site.personnel.untrained.length})`);
        doc
          .font(PdfFont.regular)
          .fontSize(8)
          .text(site.personnel.untrained.map((row) => row.fullName).join(", "), {
            width: doc.page.width - FORM_MARGIN * 2
          });
      }
    }

    drawFooterNote(
      doc,
      "Pachetul include documentele PSI aprobate (dosarul de control), registrele de verificare a mijloacelor de " +
        "stingere, exercițiile de evacuare, evidența personalului instruit PSI și a persoanelor desemnate. " +
        (input.generatedBy ? `Exportat de: ${input.generatedBy}.` : "")
    );
  });
}
