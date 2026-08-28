import { SsmTrainingCategory } from "@prisma/client";
import {
  birthDateFromCnp,
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawSignatureBox,
  drawTable,
  ensureSpace,
  FORM_MARGIN,
  formatRoDate,
  PdfFont,
  renderPdf,
  type PdfDoc
} from "./pdf-form-kit";

export type Anexa11Signature = {
  employeeSignedAt: Date | null;
  managerSignedAt: Date | null;
  responsibleSignedAt: Date | null;
  employeeSignature: string | null;
  managerSignature: string | null;
  responsibleSignature: string | null;
};

export type Anexa11TrainingRow = {
  category: SsmTrainingCategory;
  typeName: string;
  materialTitle?: string | null;
  scheduledAt: Date;
  completedAt?: Date | null;
  durationMinutes?: number | null;
  legalMinDurationHours?: number | null;
  score?: number | null;
  occupation?: string | null;
  signature?: Anexa11Signature | null;
};

export type Anexa11AccidentRow = {
  occurredAt: Date;
  title: string;
  itmDaysOff?: number | null;
  type: string;
};

export type Anexa11MedicalRow = {
  performedAt?: Date | null;
  scheduledAt: Date;
  result?: string | null;
  recommendations?: string | null;
};

export type Anexa11Employee = {
  fullName: string;
  cnp?: string | null;
  hireDate?: Date | null;
  jobName?: string | null;
  corCode?: string | null;
  departmentName?: string | null;
  worksiteName?: string | null;
  companyName?: string | null;
  cui?: string | null;
  headquarters?: string | null;
};

const MEDICAL_RESULT: Record<string, string> = {
  FIT: "Apt",
  FIT_CONDITIONAL: "Apt condiționat",
  TEMPORARY_UNFIT: "Inapt temporar",
  UNFIT: "Inapt"
};

function hoursOf(plan: Anexa11TrainingRow): string {
  if (plan.durationMinutes != null && plan.durationMinutes > 0) {
    return (plan.durationMinutes / 60).toFixed(plan.durationMinutes % 60 === 0 ? 0 : 1);
  }
  if (plan.legalMinDurationHours) return String(plan.legalMinDurationHours);
  return "";
}

function latestOf(rows: Anexa11TrainingRow[], category: SsmTrainingCategory): Anexa11TrainingRow | undefined {
  return rows
    .filter((row) => row.category === category)
    .sort((a, b) => (b.completedAt ?? b.scheduledAt).getTime() - (a.completedAt ?? a.scheduledAt).getTime())[0];
}

function drawHireBlock(
  doc: PdfDoc,
  title: string,
  plan: Anexa11TrainingRow | undefined,
  extraLine?: string
): void {
  ensureSpace(doc, 92);
    doc.font(PdfFont.bold).fontSize(9).text(title);
    doc.font(PdfFont.regular).fontSize(8);
  const date = plan ? formatRoDate(plan.completedAt ?? plan.scheduledAt) : "";
  const hours = plan ? hoursOf(plan) : "";
  const instructor = plan?.signature?.responsibleSignedAt ? "Responsabil SSM" : "";
  doc.text(
    `a fost efectuată la data ${dash(date)} timp de ${dash(hours)} ore, de către ${dash(instructor)} având funcția de ${
      instructor ? "lucrător desemnat / responsabil SSM" : "—"
    }.`
  );
  if (extraLine) doc.text(extraLine);
  doc.text(`Conținutul instruirii: ${dash(plan?.materialTitle || plan?.typeName)}`);
  doc.moveDown(0.25);
  const y = doc.y;
  const col = (doc.page.width - FORM_MARGIN * 2) / 3;
  const endY1 = drawSignatureBox(
    doc,
    "Semnătura celui instruit",
    plan?.signature?.employeeSignedAt,
    plan?.signature?.employeeSignature,
    FORM_MARGIN,
    y,
    col
  );
  const endY2 = drawSignatureBox(
    doc,
    "Semnătura celui care a efectuat instruirea",
    plan?.signature?.responsibleSignedAt,
    plan?.signature?.responsibleSignature,
    FORM_MARGIN + col,
    y,
    col
  );
  const endY3 = drawSignatureBox(
    doc,
    "Semnătura celui care a verificat însușirea cunoștințelor",
    plan?.signature?.managerSignedAt ?? plan?.signature?.responsibleSignedAt,
    plan?.signature?.managerSignature ?? plan?.signature?.responsibleSignature,
    FORM_MARGIN + col * 2,
    y,
    col
  );
  doc.y = Math.max(endY1, endY2, endY3) + 6;
}

export function renderAnexa11IndividualSheet(input: {
  employee: Anexa11Employee;
  trainings: Anexa11TrainingRow[];
  accidents: Anexa11AccidentRow[];
  medical: Anexa11MedicalRow[];
}): Promise<Buffer> {
  const { employee, trainings, accidents, medical } = input;
  const intro = latestOf(trainings, "INTRODUCTORY_GENERAL");
  const workplace = latestOf(trainings, "WORKPLACE");
  const periodic = trainings.filter(
    (row) => row.category === "PERIODIC" || row.category === "EMERGENCY_PSI"
  );
  const supplementary = trainings.filter((row) => row.category === "SUPPLEMENTARY");
  const tests = trainings.filter((row) => row.score != null);
  const occupation = employee.jobName ?? "";
  const contentWidth = 523;

  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "HG nr. 1.425/2006 pentru aprobarea Normelor metodologice de aplicare a prevederilor Legii nr. 319/2006  —  ANEXA nr. 11",
      "FIȘĂ DE INSTRUIRE INDIVIDUALĂ",
      "privind securitatea și sănătatea în muncă"
    );

    const cuiLine = employee.cui ? `CUI ${employee.cui}` : "";
    doc.font(PdfFont.bold).fontSize(8).text("ÎNTREPRINDEREA / UNITATEA");
    doc.font(PdfFont.regular).fontSize(10).text(`${dash(employee.companyName)}  ${cuiLine}`.trim());
    if (employee.headquarters) {
      doc.fontSize(8).text(`Sediul: ${employee.headquarters}`);
    }
    doc.moveDown(0.35);

    const col = (contentWidth - 12) / 2;
    let y = doc.y;
    const leftEnd = drawLabeledValue(doc, "NUMELE ȘI PRENUMELE", dash(employee.fullName), FORM_MARGIN, y, col);
    const rightEnd = drawLabeledValue(
      doc,
      "LEGITIMAȚIA, MARCA / CNP",
      dash(employee.cnp),
      FORM_MARGIN + col + 12,
      y,
      col
    );
    y = Math.max(leftEnd, rightEnd);
    const left2 = drawLabeledValue(doc, "GRUPA SANGUINĂ", " ", FORM_MARGIN, y, col);
    const right2 = drawLabeledValue(doc, "DOMICILIUL", " ", FORM_MARGIN + col + 12, y, col);
    y = Math.max(left2, right2);
    const birth = employee.cnp ? birthDateFromCnp(employee.cnp) : "";
    const left3 = drawLabeledValue(doc, "DATA ȘI LOCUL NAȘTERII", dash(birth), FORM_MARGIN, y, col);
    const right3 = drawLabeledValue(
      doc,
      "CALIFICAREA",
      dash(employee.corCode ? `${employee.jobName} (COR ${employee.corCode})` : employee.jobName),
      FORM_MARGIN + col + 12,
      y,
      col
    );
    y = Math.max(left3, right3);
    const left4 = drawLabeledValue(doc, "FUNCȚIA", dash(employee.jobName), FORM_MARGIN, y, col);
    const right4 = drawLabeledValue(
      doc,
      "LOCUL DE MUNCĂ",
      dash([employee.worksiteName, employee.departmentName].filter(Boolean).join(" / ")),
      FORM_MARGIN + col + 12,
      y,
      col
    );
    y = Math.max(left4, right4);
    const left5 = drawLabeledValue(doc, "AUTORIZAȚII (ISCIR ș.a.)", " ", FORM_MARGIN, y, col);
    const right5 = drawLabeledValue(
      doc,
      "DATA ANGĂJĂRII",
      dash(formatRoDate(employee.hireDate)),
      FORM_MARGIN + col + 12,
      y,
      col
    );
    doc.y = Math.max(left5, right5);
    doc.y = drawLabeledValue(
      doc,
      "TRASEUL DE DEPLASARE LA / DE LA SERVICIU",
      " ",
      FORM_MARGIN,
      doc.y,
      contentWidth
    );

    doc.font(PdfFont.bold).fontSize(10).text("Instruirea la angajare");
    doc.moveDown(0.2);
    drawHireBlock(doc, "1) Instruirea introductiv-generală", intro);
    drawHireBlock(
      doc,
      "2) Instruirea la locul de muncă",
      workplace,
      `Loc de muncă / post de lucru: ${dash(employee.worksiteName || employee.jobName)}`
    );

    ensureSpace(doc, 70);
    doc.font(PdfFont.bold).fontSize(9).text("3) Admis la lucru");
    const admitY = doc.y + 4;
    const admitCol = contentWidth / 2;
    drawLabeledValue(
      doc,
      "Numele și prenumele (șef secție / atelier / șantier)",
      workplace?.signature?.managerSignedAt ? "Manager / șef de departament" : " ",
      FORM_MARGIN,
      admitY,
      admitCol - 8
    );
    const admitEnd = drawSignatureBox(
      doc,
      "Data și semnătura",
      workplace?.signature?.managerSignedAt,
      workplace?.signature?.managerSignature,
      FORM_MARGIN + admitCol,
      admitY,
      admitCol
    );
    doc.y = admitEnd + 8;

    doc.font(PdfFont.bold).fontSize(10).text("Instruirea periodică");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Data instruirii", width: 70 },
        { header: "Durata (h)", width: 48, align: "center" },
        { header: "Ocupația", width: 80 },
        { header: "Materialul predat", width: 145 },
        { header: "Semnătura instruit", width: 60, align: "center" },
        { header: "Semnătura care a instruit", width: 60, align: "center" },
        { header: "Semnătura care a verificat", width: 60, align: "center" }
      ],
      periodic.map((row) => [
        formatRoDate(row.completedAt ?? row.scheduledAt),
        hoursOf(row),
        row.occupation || occupation,
        row.materialTitle || row.typeName,
        row.signature?.employeeSignedAt ? formatRoDate(row.signature.employeeSignedAt) : "",
        row.signature?.responsibleSignedAt ? formatRoDate(row.signature.responsibleSignedAt) : "",
        row.signature?.managerSignedAt || row.signature?.responsibleSignedAt
          ? formatRoDate(row.signature.managerSignedAt ?? row.signature.responsibleSignedAt)
          : ""
      ]),
      { minRows: Math.max(6, periodic.length) }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Instruire periodică suplimentară");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Data efectuării", width: 70 },
        { header: "Durata (h)", width: 48, align: "center" },
        { header: "Ocupația", width: 80 },
        { header: "Materialul predat", width: 145 },
        { header: "Semnătura instruit", width: 60, align: "center" },
        { header: "Semnătura care a instruit", width: 60, align: "center" },
        { header: "Semnătura care a verificat", width: 60, align: "center" }
      ],
      supplementary.map((row) => [
        formatRoDate(row.completedAt ?? row.scheduledAt),
        hoursOf(row),
        row.occupation || occupation,
        row.materialTitle || row.typeName,
        row.signature?.employeeSignedAt ? formatRoDate(row.signature.employeeSignedAt) : "",
        row.signature?.responsibleSignedAt ? formatRoDate(row.signature.responsibleSignedAt) : "",
        row.signature?.managerSignedAt || row.signature?.responsibleSignedAt
          ? formatRoDate(row.signature.managerSignedAt ?? row.signature.responsibleSignedAt)
          : ""
      ]),
      { minRows: Math.max(4, supplementary.length) }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Rezultatele testărilor");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Data", width: 80 },
        { header: "Materialul examinat", width: 230 },
        { header: "Calificativ", width: 106, align: "center" },
        { header: "Examinator", width: 107 }
      ],
      tests.map((row) => [
        formatRoDate(row.completedAt ?? row.scheduledAt),
        row.materialTitle || row.typeName,
        row.score != null ? `${row.score}%` : "",
        "Responsabil SSM"
      ]),
      { minRows: Math.max(4, tests.length) }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Accidente de muncă sau îmbolnăviri profesionale suferite");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Data producerii evenimentului", width: 110 },
        { header: "Diagnosticul medical / descriere", width: 220 },
        { header: "Nr. și data PV de cercetare", width: 123 },
        { header: "Nr. zile ITM", width: 70, align: "center" }
      ],
      accidents.map((row) => [
        formatRoDate(row.occurredAt),
        `${row.type}: ${row.title}`,
        "",
        row.itmDaysOff != null ? String(row.itmDaysOff) : ""
      ]),
      { minRows: Math.max(3, accidents.length) }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Sancțiuni aplicate pentru nerespectarea reglementărilor de SSM");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Abaterea săvârșită", width: 220 },
        { header: "Sancțiunea administrativă", width: 170 },
        { header: "Nr. și data deciziei", width: 133 }
      ],
      [],
      { minRows: 3 }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Control medical periodic — observații de specialitate");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Data vizei", width: 90 },
        { header: "Rezultat / observații medic medicina muncii", width: 323 },
        { header: "Parafă / dată", width: 110 }
      ],
      medical.map((row) => [
        formatRoDate(row.performedAt ?? row.scheduledAt),
        [row.result ? MEDICAL_RESULT[row.result] ?? row.result : "", row.recommendations].filter(Boolean).join(" — "),
        formatRoDate(row.performedAt)
      ]),
      { minRows: Math.max(4, medical.length) }
    );

    doc.font(PdfFont.bold).fontSize(10).text("Testarea psihologică periodică");
    doc.moveDown(0.1);
    doc.font(PdfFont.regular).fontSize(7).text("* lucru la înălțime, lucru în condiții de izolare, conducători auto etc.");
    doc.moveDown(0.15);
    drawTable(
      doc,
      [
        { header: "Apt psihologic pentru*", width: 261 },
        { header: "Semnătura și data psihologului", width: 262 }
      ],
      [],
      { minRows: 4, rowMinHeight: 28 }
    );

    drawFooterNote(
      doc,
      "Forma electronică a Anexei nr. 11 la HG nr. 1.425/2006. Semnăturile olografe sunt cele înregistrate în platformă. Câmpurile fără date în evidență rămân disponibile pentru completare la control ITM."
    );
  });
}
