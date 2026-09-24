import { BadRequestException, ValidationError } from "@nestjs/common";

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/property (.+) should not exist/g, "Câmpul $1 nu este permis."],
  [/must be longer than or equal to (\d+) characters/g, "trebuie să aibă cel puțin $1 caractere"],
  [/must be shorter than or equal to (\d+) characters/g, "trebuie să aibă cel mult $1 caractere"],
  [/must be a number conforming to the specified constraints/g, "trebuie să fie un număr valid"],
  [/must be a valid ISO 8601 date string/g, "trebuie să fie o dată validă"],
  [/must not be less than/g, "nu poate fi mai mic decât"],
  [/must not be greater than/g, "nu poate fi mai mare decât"],
  [/must be an integer number/g, "trebuie să fie un număr întreg"],
  [/must be a positive number/g, "trebuie să fie un număr pozitiv"],
  [/must be a boolean value/g, "trebuie să fie da sau nu"],
  [/must be a valid enum value/g, "are o valoare nepermisă"],
  [/must be an email/g, "trebuie să fie o adresă de e-mail validă"],
  [/must be a string/g, "trebuie să fie text"],
  [/must be a UUID/g, "trebuie să fie un identificator valid"],
  [/must be a Date instance/g, "trebuie să fie o dată validă"],
  [/should not be empty/g, "nu trebuie să fie gol"],
  [/must be an array/g, "trebuie să fie o listă"],
  [/must be an object/g, "trebuie să fie un obiect"],
  [/must contain at least (\d+) elements/g, "trebuie să conțină cel puțin $1 elemente"]
];

export function localizeValidationMessage(message: string): string {
  let text = message;
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function collectValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        messages.push(localizeValidationMessage(message));
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
