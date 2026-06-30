import type {
  CommunicationAnnouncementItem,
  CommunicationAudienceType,
  CommunicationContentType,
  CommunicationMessageType
} from "@repo/shared-types/communications";

export const CONTENT_TYPES: CommunicationContentType[] = [
  "TEXT",
  "RICH_TEXT",
  "LINK",
  "DOCUMENT",
  "SURVEY",
  "IMAGE",
  "VIDEO",
  "SLIDE",
  "BUTTON"
];

export const MESSAGE_TYPES: CommunicationMessageType[] = ["ANNOUNCEMENT", "QUESTION", "READ_CONFIRMATION"];

export const AUDIENCE_TYPES: CommunicationAudienceType[] = [
  "ALL",
  "WORKSITE",
  "DEPARTMENT",
  "JOB_POSITION",
  "EMPLOYEE_GROUP",
  "EMPLOYEE",
  "CUSTOM"
];

export const CONTENT_TYPE_LABELS: Record<CommunicationContentType, string> = {
  TEXT: "Text simplu",
  RICH_TEXT: "Text formatat",
  LINK: "Link extern",
  DOCUMENT: "Document",
  SURVEY: "Sondaj integrat",
  IMAGE: "Imagine",
  VIDEO: "Video",
  SLIDE: "Slide / prezentare",
  BUTTON: "Buton acțiune"
};

export const MESSAGE_TYPE_LABELS: Record<CommunicationMessageType, string> = {
  ANNOUNCEMENT: "Anunț",
  QUESTION: "Întrebare",
  READ_CONFIRMATION: "Confirmare citire"
};

export const STATUS_LABELS: Record<CommunicationAnnouncementItem["status"], string> = {
  DRAFT: "Ciornă",
  READY_TO_SEND: "Gata de trimis",
  SCHEDULED: "Programat",
  PUBLISHED: "Publicat",
  RETRACTED: "Retras",
  ARCHIVED: "Arhivat"
};

export const AUDIENCE_LABELS: Record<CommunicationAudienceType, string> = {
  ALL: "Toți angajații",
  WORKSITE: "Punct de lucru",
  DEPARTMENT: "Departament",
  JOB_POSITION: "Post",
  EMPLOYEE_GROUP: "Grup angajați",
  EMPLOYEE: "Angajat individual",
  CUSTOM: "Listă personalizată"
};

export type CommsTab = "list" | "compose" | "templates" | "reminders" | "calendar" | "usage";

export function formatCommsDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function statusTone(status: CommunicationAnnouncementItem["status"]): "good" | "warn" | "bad" {
  if (status === "PUBLISHED") return "good";
  if (status === "SCHEDULED" || status === "DRAFT" || status === "READY_TO_SEND") return "warn";
  return "bad";
}

export function mutationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "A apărut o eroare neașteptată.";
  }
  const translations: Record<string, string> = {
    "Invalid date": "Dată invalidă",
    "Employee not found for tenant.": "Angajatul nu a fost găsit.",
    "Template not found for tenant.": "Șablonul nu a fost găsit.",
    "Announcement not found for tenant.": "Anunțul nu a fost găsit.",
    "Custom audience requires targetEmployeeIds.": "Lista personalizată necesită cel puțin un angajat.",
    "One or more target employees were not found for tenant.": "Unii angajați selectați nu există.",
    "Not signed in or session expired. Sign in with tenant e01 and try again.": "Sesiunea a expirat. Autentifică-te din nou.",
    "You do not have permission for this action.": "Nu ai permisiune pentru această acțiune.",
    "API route not found.": "Ruta API nu a fost găsită.",
    "Request failed": "Cererea a eșuat",
    "Cannot reach the API": "API-ul nu poate fi contactat"
  };
  const exact = translations[error.message];
  if (exact) return exact;
  const partial = Object.entries(translations).find(([key]) => error.message.includes(key));
  return partial ? error.message.replace(partial[0], partial[1]) : error.message;
}
