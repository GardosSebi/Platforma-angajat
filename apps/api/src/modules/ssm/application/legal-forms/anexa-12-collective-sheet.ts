import {
  dash,
  drawFooterNote,
  drawLabeledValue,
  drawLegalBanner,
  drawTable,
  FORM_MARGIN,
  formatRoDate,
  PdfFont,
  renderPdf
} from "./pdf-form-kit";

export type Anexa12CollectiveInput = {
  companyName: string;
  cui?: string | null;
  title: string;
  trainerName?: string | null;
  trainerFunction?: string | null;
  location?: string | null;
  visitDates?: string | null;
  attendees: string[];
  createdAt?: Date;
};

function parseAttendee(raw: string): { name: string; identity: string } {
  const [name, identity] = raw.split("|").map((part) => part.trim());
  return { name: name || raw.trim(), identity: identity ?? "" };
}

export function renderAnexa12CollectiveSheet(input: Anexa12CollectiveInput): Promise<Buffer> {
  const createdAt = input.createdAt ?? new Date();
  const attendees = input.attendees.map(parseAttendee);

  return renderPdf((doc) => {
    drawLegalBanner(
      doc,
      "HG nr. 1.425/2006 pentru aprobarea Normelor metodologice de aplicare a prevederilor Legii nr. 319/2006  —  ANEXA nr. 12",
      "FIȘĂ DE INSTRUIRE COLECTIVĂ",
      "privind securitatea și sănătatea în muncă"
    );

    const width = doc.page.width - FORM_MARGIN * 2;
    let y = doc.y;
    y = drawLabeledValue(
      doc,
      "ÎNTREPRINDEREA / UNITATEA",
      `${dash(input.companyName)}${input.cui ? `  CUI ${input.cui}` : ""}`,
      FORM_MARGIN,
      y,
      width
    );
    y = drawLabeledValue(doc, "Întocmită azi", formatRoDate(createdAt), FORM_MARGIN, y, width / 2 - 6);
    doc.y = y;

    doc.font(PdfFont.regular).fontSize(9).text(
      `Subsemnatul ${dash(input.trainerName)}, având funcția de ${dash(
        input.trainerFunction || "responsabil SSM / lucrător desemnat"
      )}, am procedat la instruirea unui număr de ${attendees.length} persoane de la ${dash(
        input.location
      )}, conform tabelului nominal, în domeniul securității și sănătății în muncă, pentru vizita (prezența) în întreprindere/unitate în zilele ${dash(
        input.visitDates || formatRoDate(createdAt)
      )}.`
    );
    doc.moveDown(0.35);
    doc.font(PdfFont.bold).fontSize(9).text("În cadrul instruirii s-au prelucrat următoarele materiale:");
    doc.font(PdfFont.regular).fontSize(9).text(dash(input.title));
    doc.moveDown(0.25);
    doc.text("Prezenta fișă de instructaj se va păstra la angajatorul lucrătorilor / conducătorul grupului (art. 82 alin. (4) HG 1.425/2006).");
    doc.moveDown(0.5);

    const col = width / 2;
    const signY = doc.y;
    doc.font(PdfFont.bold).fontSize(8).text("Verificat,", FORM_MARGIN, signY, { width: col, align: "center" });
    doc.text("Semnătura celui care a efectuat instruirea", FORM_MARGIN + col, signY, {
      width: col,
      align: "center"
    });
    doc.moveTo(FORM_MARGIN + 24, signY + 36)
      .lineTo(FORM_MARGIN + col - 24, signY + 36)
      .lineWidth(0.4)
      .stroke();
    doc.moveTo(FORM_MARGIN + col + 24, signY + 36)
      .lineTo(FORM_MARGIN + width - 24, signY + 36)
      .stroke();
    doc.y = signY + 48;

    doc.font(PdfFont.bold).fontSize(10).text("TABEL NOMINAL cu persoanele participante la instruire");
    doc.font(PdfFont.regular).fontSize(8).text(
      "Subsemnații am fost instruiți și am luat cunoștință de materialele prelucrate și consemnate în fișa de instruire colectivă privind securitatea și sănătatea în muncă și ne obligăm să le respectăm întocmai."
    );
    doc.moveDown(0.2);

    drawTable(
      doc,
      [
        { header: "Nr. crt.", width: 40, align: "center" },
        { header: "Numele și prenumele", width: 220 },
        { header: "Act identitate / grupa sanguină", width: 160 },
        { header: "Semnătura", width: 103, align: "center" }
      ],
      attendees.map((person, index) => [String(index + 1), person.name, person.identity, ""]),
      { minRows: Math.max(10, attendees.length), rowMinHeight: 22 }
    );

    doc.font(PdfFont.regular).fontSize(8).text(
      "Numele și prenumele persoanei care a primit un exemplar: ________________________________"
    );
    doc.moveDown(0.4);
    doc.text("Semnătura: _______________________________");
    doc.moveDown(0.6);
    doc.font(PdfFont.bold).fontSize(8).text("Notă: Fișa se completează în 2 exemplare.");

    drawFooterNote(
      doc,
      "Forma electronică a Anexei nr. 12 la HG nr. 1.425/2006 (instruire lucrători din întreprinderi externe / vizitatori). Semnăturile participanților se completează olograf pe exemplarul tipărit, dacă nu sunt capturate în platformă."
    );
  });
}
