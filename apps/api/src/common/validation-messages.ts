import { BadRequestException, ValidationError } from "@nestjs/common";

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/must be longer than or equal to (\d+) characters/g, "trebuie să aibă cel puțin $1 caractere"],
  [/must be shorter than or equal to (\d+) characters/g, "trebuie să aibă cel mult $1 caractere"],
  [/must be a number conforming to the specified constraints/g, "trebuie să fie un număr valid"],
  [/must be a valid ISO 8601 date string/g, "trebuie să fie o dată validă"],
  [/must not be less than/g, "nu poate fi sub"],
  [/must not be greater than/g, "nu poate depăși"],
  [/must be an integer number/g, "trebuie să fie un număr întreg"],
  [/must be a positive number/g, "trebuie să fie un număr pozitiv"],
  [/must be a boolean value/g, "trebuie să fie da sau nu"],
  [/must be one of the following values:/g, "trebuie să fie una dintre valorile:"],
  [/must be a valid enum value/g, "are o valoare nepermisă"],
  [/must be an email/g, "trebuie să fie o adresă de e-mail validă"],
  [/must be a URL address/g, "trebuie să fie o adresă web validă"],
  [/must be a string/g, "trebuie să fie text"],
  [/must be a UUID/g, "trebuie să fie un identificator valid"],
  [/must be a Date instance/g, "trebuie să fie o dată validă"],
  [/should not be empty/g, "nu poate lipsi"],
  [/must be an array/g, "trebuie să fie o listă"],
  [/must be an object/g, "trebuie să fie un obiect"],
  [/must contain at least (\d+) elements/g, "trebuie să conțină cel puțin $1 elemente"],
  [/must contain no more than (\d+) elements/g, "trebuie să conțină cel mult $1 elemente"]
];

const FIELD_LABELS: Record<string, string> = {
  email: "E-mailul",
  password: "Parola",
  username: "Utilizatorul",
  token: "Codul de resetare",
  tenantId: "Organizația",
  fullName: "Numele complet",
  name: "Denumirea",
  title: "Titlul",
  description: "Descrierea",
  notes: "Observațiile",
  body: "Mesajul",
  subject: "Subiectul",
  code: "Codul",
  status: "Starea",
  active: "Starea activ/inactiv",
  type: "Tipul",
  category: "Categoria",
  priority: "Prioritatea",
  role: "Rolul",
  roles: "Rolurile",
  phone: "Telefonul",
  cnp: "CNP-ul",
  cui: "CUI-ul",
  address: "Adresa",
  location: "Locația",
  headquarters: "Sediul",
  companyName: "Denumirea firmei",
  employeeId: "Angajatul",
  worksiteId: "Punctul de lucru",
  worksiteIds: "Punctele de lucru",
  departmentId: "Departamentul",
  jobPositionId: "Postul",
  legalEntityId: "Entitatea juridică",
  employeeGroupId: "Grupul",
  employmentType: "Tipul angajării",
  hireDate: "Data angajării",
  leaveDate: "Data plecării",
  dueAt: "Termenul",
  dueDate: "Termenul",
  scheduledAt: "Data programării",
  startsAt: "Data de început",
  endsAt: "Data de sfârșit",
  expiresAt: "Data expirării",
  validUntil: "Data de valabilitate",
  periodFrom: "Începutul perioadei",
  periodTo: "Sfârșitul perioadei",
  occurredAt: "Data producerii",
  preferredDate: "Data preferată",
  quantity: "Cantitatea",
  trainingTypeId: "Tipul de instruire",
  trainerName: "Numele instructorului",
  trainerFunction: "Funcția instructorului",
  signature: "Semnătura",
  signatureData: "Semnătura",
  contentUrl: "Fișierul",
  contentType: "Tipul conținutului",
  audienceType: "Destinatarii",
  messageType: "Tipul mesajului",
  answers: "Răspunsurile",
  answerText: "Răspunsul",
  options: "Opțiunile",
  reason: "Motivul",
  confirmPhrase: "Textul de confirmare",
  csv: "Conținutul CSV",
  page: "Pagina",
  pageSize: "Dimensiunea paginii",
  search: "Căutarea"
};

function fieldLabel(property: string): string {
  return FIELD_LABELS[property] ?? `Câmpul „${property}”`;
}

export function localizeValidationMessage(message: string, property?: string): string {
  const notAllowed = /^property (.+) should not exist$/.exec(message);
  if (notAllowed) {
    return `${fieldLabel(notAllowed[1])}: câmp nepermis.`;
  }

  let text = message;
  if (property) {
    if (text.startsWith(`each value in ${property} `)) {
      text = `Fiecare valoare din ${fieldLabel(property).toLowerCase()} ${text.slice(`each value in ${property} `.length)}`;
    } else if (text.startsWith(`${property} `)) {
      text = `${fieldLabel(property)} ${text.slice(property.length + 1)}`;
    }
  }
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function collectValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        messages.push(localizeValidationMessage(message, error.property));
      }
    }
    if (error.children?.length) {
      messages.push(...collectValidationMessages(error.children));
    }
  }
  return messages;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const messages = collectValidationMessages(errors);
  return new BadRequestException(messages.length ? messages : ["Datele trimise nu sunt valide."]);
}
