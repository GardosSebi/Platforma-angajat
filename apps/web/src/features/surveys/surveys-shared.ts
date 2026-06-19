import type { SurveyAudienceType, SurveyStatus } from "@repo/shared-types/surveys";

export const AUDIENCE_TYPES: SurveyAudienceType[] = [
  "ALL",
  "WORKSITE",
  "DEPARTMENT",
  "JOB_POSITION",
  "EMPLOYEE",
  "CUSTOM"
];

export const AUDIENCE_LABELS: Record<SurveyAudienceType, string> = {
  ALL: "Toți angajații",
  WORKSITE: "Punct de lucru",
  DEPARTMENT: "Departament",
  JOB_POSITION: "Post",
  EMPLOYEE_GROUP: "Grup angajați",
  EMPLOYEE: "Angajat",
  CUSTOM: "Listă personalizată"
};

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  DRAFT: "Ciornă",
  ACTIVE: "Activ",
  CLOSED: "Închis",
  ARCHIVED: "Arhivat"
};

export type SurveyTab = "list" | "create" | "manage";

export function formatSurveyDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function surveyStatusTone(status: SurveyStatus): "good" | "warn" | "bad" {
  if (status === "ACTIVE") return "good";
  if (status === "DRAFT") return "warn";
  return "bad";
}

export function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}
