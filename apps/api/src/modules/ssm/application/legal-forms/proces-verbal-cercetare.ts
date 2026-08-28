import { SsmAccidentAttachmentKind, SsmAccidentType } from "@prisma/client";
import {
  dash,
  drawChapter,
  drawFooterNote,
  drawLegalBanner,
  drawParagraph,
  drawTable,
  formatRoDate,
  formatRoDateTime,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type PvCercetareInput = {
  caseId: string;
  type: SsmAccidentType;
  title: string;
  status: string;
  occurredAt: Date;
  location?: string | null;
  description: string;
  witnesses: string[];
  contributingFactors?: string | null;
  immediateMeasures?: string | null;
  itmDaysOff?: number | null;
  hasPermanentDisability: boolean;
  isFatality: boolean;
  diseaseConfirmed?: boolean;
  diseaseConfirmedAt?: Date | null;
  diseaseConfirmedBy?: string | null;
  diseaseDocumentRef?: string | null;
  researchResponsible?: string | null;
  conclusions?: string | null;
  correctiveMeasures?: string | null;
  legalDaysDeadline: number;
  dueAt: Date;
  closedAt?: Date | null;
  createdAt: Date;
  employer: {
    name: string;
    cui?: string | null;
    headquarters?: string | null;
    worksiteName?: string | null;
    worksiteAddress?: string | null;
    departmentName?: string | null;
  };
  victim: {
    fullName?: string | null;
    cnp?: string | null;
    birthDate?: string | null;
    email?: string | null;
    jobName?: string | null;
    hireDate?: Date | null;
    worksiteName?: string | null;
    lastTrainingAt?: Date | null;
    lastTrainingName?: string | null;
  };
  tasks: Array<{
    title: string;
    assignedTo?: string | null;
    dueAt: Date;
    completedAt?: Date | null;
    notes?: string | null;
  }>;
  measures: Array<{
    description: string;
    assignedTo?: string | null;
    dueAt: Date;
    completedAt?: Date | null;
  }>;
  attachments: Array<{
    kind: SsmAccidentAttachmentKind;
    fileName: string;
    notes?: string | null;
  }>;
};

function attachmentKindRo(kind: SsmAccidentAttachmentKind): string {
  switch (kind) {
    case SsmAccidentAttachmentKind.PHOTO:
      return "Poză";
    case SsmAccidentAttachmentKind.PV:
      return "Proces-verbal";
    case SsmAccidentAttachmentKind.EXPERTISE:
      return "Expertiză";
    default:
      return "Alt document";
  }
}

function objectOfResearch(type: SsmAccidentType): string {
  switch (type) {
    case SsmAccidentType.ACCIDENT:
      return "cercetarea accidentului de muncă";
    case SsmAccidentType.INCIDENT:
      return "cercetarea incidentului periculos";
    case SsmAccidentType.OCCUPATIONAL_DISEASE:
      return "cercetarea bolii profesionale";
    default:
      return "cercetarea evenimentului";
  }
}

export function accidentCharacter(input: PvCercetareInput): string {
  if (input.type === SsmAccidentType.INCIDENT) {
    return "Incident periculos (art. 5 din Legea nr. 319/2006)";
  }
  if (input.type === SsmAccidentType.OCCUPATIONAL_DISEASE) {
    return input.diseaseConfirmed ? "Boală profesională confirmată" : "Boală profesională (în curs de confirmare)";
  }
  if (input.isFatality) return "Accident de muncă mortal";
  if (input.hasPermanentDisability) return "Accident de muncă soldat cu invaliditate";
  if (input.itmDaysOff != null && input.itmDaysOff > 0) {
    return `Accident de muncă soldat cu incapacitate temporară de muncă (${input.itmDaysOff} zile ITM)`;
  }
  return "Accident de muncă";
}

function seniorityYears(hireDate?: Date | null): string {
  if (!hireDate) return "—";
  const years = (Date.now() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0) return "—";
  return `${years.toFixed(1)} ani (de la ${formatRoDate(hireDate)})`;
}

export function renderProcesVerbalCercetare(input: PvCercetareInput): Promise<Buffer> {
  const closedAt = input.closedAt ?? new Date();
  const character = accidentCharacter(input);
  const includeEmployerVisa = input.type === SsmAccidentType.ACCIDENT && (input.itmDaysOff ?? 0) > 0;

  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "Legea nr. 319/2006  ·  HG nr. 1.425/2006, art. 128–129 (conținutul procesului-verbal de cercetare a evenimentului)",
      "PROCES-VERBAL DE CERCETARE A EVENIMENTULUI",
      character
    );

    doc.font(PdfFont.regular).fontSize(8).text(`Nr. intern dosar: ${input.caseId}    Status cercetare: ${input.status}`);
    doc.moveDown(0.3);

    drawChapter(doc, "a", "Data încheierii procesului-verbal");
    drawParagraph(doc, formatRoDateTime(closedAt));

    drawChapter(doc, "b", "Persoanele și calitatea în care efectuează cercetarea");
    drawParagraph(
      doc,
      `${dash(input.researchResponsible)} — responsabil cercetare desemnat de angajator, potrivit art. 29 din Legea nr. 319/2006 și art. 115–129 din HG nr. 1.425/2006.`
    );

    drawChapter(doc, "c", "Perioada de timp și locul în care s-a efectuat cercetarea");
    drawParagraph(
      doc,
      `Perioada: ${formatRoDate(input.createdAt)} – ${formatRoDate(closedAt)}. Locul cercetării: ${dash(
        input.employer.worksiteName || input.location || input.employer.headquarters
      )}. Termen legal: ${input.legalDaysDeadline} zile (scadență ${formatRoDate(input.dueAt)}).`
    );

    drawChapter(doc, "d", "Obiectul cercetării");
    drawParagraph(doc, `${objectOfResearch(input.type)} — ${input.title}`);

    drawChapter(doc, "e", "Data și ora producerii evenimentului");
    drawParagraph(doc, formatRoDateTime(input.occurredAt));

    drawChapter(doc, "f", "Locul producerii evenimentului");
    drawParagraph(
      doc,
      dash(
        [input.location, input.employer.worksiteName, input.employer.worksiteAddress, input.employer.departmentName]
          .filter(Boolean)
          .join(" — ")
      )
    );

    drawChapter(doc, "g", "Datele de identificare a angajatorului");
    drawParagraph(
      doc,
      [
        `Denumire: ${dash(input.employer.name)}`,
        `CUI: ${dash(input.employer.cui)}`,
        `Sediul: ${dash(input.employer.headquarters)}`,
        `Punct de lucru: ${dash(input.employer.worksiteName)}`,
        `Adresa punctului de lucru: ${dash(input.employer.worksiteAddress)}`,
        "Reprezentant legal: conform evidenței angajatorului"
      ].join("\n")
    );

    drawChapter(doc, "h", "Datele de identificare a accidentatului / accidentaților");
    drawParagraph(
      doc,
      [
        `Nume și prenume: ${dash(input.victim.fullName)}`,
        `CNP: ${dash(input.victim.cnp)}`,
        `Data nașterii (din CNP): ${dash(input.victim.birthDate)}`,
        `Locul de muncă: ${dash(input.victim.worksiteName || input.employer.worksiteName)}`,
        `Profesia / ocupația în momentul accidentării: ${dash(input.victim.jobName)}`,
        `Vechime la locul de muncă: ${seniorityYears(input.victim.hireDate)}`,
        `Data ultimului instructaj SSM: ${dash(
          input.victim.lastTrainingAt
            ? `${formatRoDate(input.victim.lastTrainingAt)}${input.victim.lastTrainingName ? ` (${input.victim.lastTrainingName})` : ""}`
            : null
        )}`,
        `Contact: ${dash(input.victim.email)}`,
        "Cetățenie / stare civilă / nr. copii minori / domiciliu: nu figurează în evidența platformei — de completat la cercetare, conform art. 129 alin. (5)."
      ].join("\n")
    );

    drawChapter(
      doc,
      "i",
      "Descrierea detaliată a locului, echipamentului de muncă, a împrejurărilor și a modului de producere"
    );
    drawParagraph(doc, input.description);
    if (input.witnesses.length) {
      drawParagraph(doc, `Martori: ${input.witnesses.join("; ")}`);
    }
    if (input.attachments.length) {
      drawParagraph(
        doc,
        `Probe / înscrisuri la dosar: ${input.attachments
          .map((att) => `[${attachmentKindRo(att.kind)}] ${att.fileName}${att.notes ? ` (${att.notes})` : ""}`)
          .join("; ")}`
      );
    }

    drawChapter(doc, "j", "Urmările evenimentului și/sau urmările suferite de persoanele accidentate");
    if (input.type === SsmAccidentType.OCCUPATIONAL_DISEASE) {
      drawParagraph(
        doc,
        [
          `Boală profesională confirmată: ${input.diseaseConfirmed ? "Da" : "Nu"}`,
          `Data confirmării: ${dash(formatRoDate(input.diseaseConfirmedAt))}`,
          `Autoritate / medic: ${dash(input.diseaseConfirmedBy)}`,
          `Document / referință: ${dash(input.diseaseDocumentRef)}`
        ].join("\n")
      );
    } else if (input.type === SsmAccidentType.INCIDENT) {
      drawParagraph(
        doc,
        `Incident periculos (near-miss). Măsuri imediate: ${dash(input.immediateMeasures)}`
      );
    } else {
      drawParagraph(
        doc,
        [
          `Incapacitate temporară de muncă (zile ITM): ${input.itmDaysOff != null ? String(input.itmDaysOff) : "—"}`,
          `Invaliditate permanentă: ${input.hasPermanentDisability ? "Da" : "Nu"}`,
          `Deces: ${input.isFatality ? "Da" : "Nu"}`
        ].join("\n")
      );
    }

    drawChapter(doc, "k", "Cauza producerii evenimentului");
    drawParagraph(doc, input.contributingFactors || input.conclusions || "—");

    drawChapter(doc, "l", "Alte cauze care au concurat la producerea evenimentului");
    drawParagraph(
      doc,
      input.contributingFactors && input.conclusions && input.contributingFactors !== input.conclusions
        ? input.conclusions
        : "—"
    );

    drawChapter(doc, "m", "Alte constatări făcute cu ocazia cercetării evenimentului");
    if (!input.tasks.length) {
      drawParagraph(doc, "—");
    } else {
      drawTable(
        doc,
        [
          { header: "Activitate de cercetare", width: 230 },
          { header: "Responsabil", width: 110 },
          { header: "Termen", width: 80 },
          { header: "Stare", width: 103 }
        ],
        input.tasks.map((task) => [
          `${task.title}${task.notes ? ` — ${task.notes}` : ""}`,
          task.assignedTo ?? "",
          formatRoDate(task.dueAt),
          task.completedAt ? `Finalizat ${formatRoDate(task.completedAt)}` : "În curs"
        ])
      );
    }

    drawChapter(doc, "n", "Persoanele răspunzătoare de încălcarea reglementărilor legale");
    drawParagraph(doc, "De stabilit prin cercetare. Nu sunt înregistrate nominal distinct în evidența electronică.");

    drawChapter(doc, "o", "Propuneri pentru sancțiuni administrative și disciplinare");
    drawParagraph(doc, "— (capitol denumit conform art. 129 alin. (8) pentru cercetarea efectuată de comisia angajatorului)");

    drawChapter(doc, "p", "Propuneri pentru cercetare penală");
    drawParagraph(doc, "—");

    drawChapter(doc, "q", "Caracterul accidentului");
    drawParagraph(doc, character);

    drawChapter(doc, "r", "Angajatorul care înregistrează accidentul de muncă sau incidentul periculos");
    drawParagraph(doc, dash(input.employer.name));

    drawChapter(
      doc,
      "s",
      "Măsuri dispuse pentru prevenirea altor evenimente similare și persoanele responsabile"
    );
    if (input.measures.length) {
      drawTable(
        doc,
        [
          { header: "Măsura dispusă", width: 250 },
          { header: "Responsabil", width: 110 },
          { header: "Termen", width: 80 },
          { header: "Realizare", width: 83 }
        ],
        input.measures.map((measure) => [
          measure.description,
          measure.assignedTo ?? "",
          formatRoDate(measure.dueAt),
          measure.completedAt ? `Realizat ${formatRoDate(measure.completedAt)}` : "Deschis"
        ])
      );
    } else {
      drawParagraph(doc, dash(input.correctiveMeasures));
    }

    drawChapter(doc, "t", "Termenul de raportare la inspectoratul teritorial de muncă privind realizarea măsurilor");
    drawParagraph(
      doc,
      `Raportare la ITM privind realizarea măsurilor de la lit. s): ${formatRoDate(input.dueAt)} (termen intern ${input.legalDaysDeadline} zile).`
    );

    drawChapter(doc, "u", "Numărul de exemplare și repartizarea acestora");
    drawParagraph(
      doc,
      "Procesul-verbal se încheie în 3 exemplare: 1) angajator; 2) inspectoratul teritorial de muncă; 3) persoana accidentată / reprezentant."
    );

    drawChapter(doc, "v", "Numele și semnătura persoanei / persoanelor care au efectuat cercetarea");
    drawParagraph(doc, `${dash(input.researchResponsible)}\nSemnătura: _______________________________    Data: ${formatRoDate(closedAt)}`);

    if (includeEmployerVisa) {
      drawChapter(doc, "w", "Viza angajatorului");
      drawParagraph(
        doc,
        "Conform art. 129 alin. (10) HG nr. 1.425/2006, în cazul accidentelor soldate cu incapacitate temporară de muncă, procesul-verbal se încheie cu viza angajatorului.\n\nAngajator / reprezentant legal: _______________________________    Semnătura și ștampila: ____________________    Data: __________"
      );
    }

    drawFooterNote(
      doc,
      "Document întocmit pe structura obligatorie a art. 128 din HG nr. 1.425/2006. Capitolele fără date în platformă rămân disponibile pentru completare olografă la cercetare / control ITM."
    );
  });
}
