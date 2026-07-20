import type {
  CommunicationAnnouncementItem,
  CommunicationAudienceType,
  CommunicationContentType,
  CommunicationMessageType,
  CommunicationTranslations,
  CreateCommunicationAnnouncementRequest
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

export type CommsTab = "list" | "compose" | "templates" | "reminders" | "calendar" | "usage" | "rights";

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

export const TRANSLATION_LOCALE_LABELS: Record<string, string> = {
  ro: "Română",
  en: "English"
};

export type AnnouncementFormFields = CreateCommunicationAnnouncementRequest & {
  targetEmployeeIdsCsv: string;
  translationRoTitle: string;
  translationRoBody: string;
  translationEnTitle: string;
  translationEnBody: string;
};

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function resolveAnnouncementText(
  item: { title: string; body: string; translations?: CommunicationTranslations | null },
  locale = typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "ro"
): { title: string; body: string } {
  const translated = item.translations?.[locale];
  if (translated?.title?.trim() && translated?.body?.trim()) {
    return { title: translated.title.trim(), body: translated.body.trim() };
  }
  return { title: item.title, body: item.body };
}

export function announcementToForm(item: CommunicationAnnouncementItem): AnnouncementFormFields {
  const ro = item.translations?.ro;
  const en = item.translations?.en;
  const editableStatus =
    item.status === "PUBLISHED" || item.status === "DRAFT" || item.status === "READY_TO_SEND"
      ? item.status
      : "DRAFT";

  return {
    title: item.title,
    body: item.body,
    category: item.category,
    contentType: item.contentType,
    contentUrl: item.contentUrl ?? "",
    messageType: item.messageType,
    requireReadConfirmation: item.requireReadConfirmation,
    linkedSurveyId: item.linkedSurveyId ?? undefined,
    buttonLabel: item.buttonLabel ?? undefined,
    buttonUrl: item.buttonUrl ?? undefined,
    reactionsEnabled: item.reactionsEnabled,
    audienceType: item.audienceType,
    audienceRefId: item.audienceRefId ?? "",
    audienceLabel: item.audienceLabel ?? "",
    status: editableStatus,
    publishAt: toDatetimeLocalValue(item.publishAt),
    expiresAt: toDatetimeLocalValue(item.expiresAt),
    reminderAt: toDatetimeLocalValue(item.reminderAt),
    templateId: item.templateId ?? undefined,
    targetEmployeeIdsCsv: item.targetEmployeeIds.join(", "),
    translationRoTitle: ro?.title ?? "",
    translationRoBody: ro?.body ?? "",
    translationEnTitle: en?.title ?? "",
    translationEnBody: en?.body ?? ""
  };
}

export function buildAnnouncementPayload(form: AnnouncementFormFields): CreateCommunicationAnnouncementRequest {
  const { targetEmployeeIdsCsv, translationRoTitle, translationRoBody, translationEnTitle, translationEnBody, ...rest } =
    form;
  const translations: CommunicationTranslations = {};
  if (translationRoTitle.trim() || translationRoBody.trim()) {
    translations.ro = {
      title: translationRoTitle.trim() || form.title,
      body: translationRoBody.trim() || form.body
    };
  }
  if (translationEnTitle.trim() || translationEnBody.trim()) {
    translations.en = {
      title: translationEnTitle.trim() || form.title,
      body: translationEnBody.trim() || form.body
    };
  }

  return {
    ...rest,
    title: form.title.trim(),
    body: form.body.trim(),
    contentUrl: form.contentUrl || undefined,
    linkedSurveyId: form.linkedSurveyId || undefined,
    buttonLabel: form.buttonLabel || undefined,
    buttonUrl: form.buttonUrl || undefined,
    translations: Object.keys(translations).length ? translations : undefined,
    audienceRefId: form.audienceRefId || undefined,
    audienceLabel: form.audienceLabel || undefined,
    targetEmployeeIds:
      form.audienceType === "CUSTOM"
        ? targetEmployeeIdsCsv
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined,
    publishAt: form.publishAt || undefined,
    expiresAt: form.expiresAt || undefined,
    reminderAt: form.reminderAt || undefined,
    templateId: form.templateId || undefined
  };
}

export function canDeleteAnnouncement(status: CommunicationAnnouncementItem["status"]): boolean {
  return status === "DRAFT" || status === "READY_TO_SEND" || status === "RETRACTED" || status === "ARCHIVED";
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
    "Doar ciornele, anunțurile gata de trimis, retrase sau arhivate pot fi șterse. Retrage mai întâi anunțurile publicate.":
      "Doar ciornele, anunțurile gata de trimis, retrase sau arhivate pot fi șterse. Retrage mai întâi anunțurile publicate.",
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
