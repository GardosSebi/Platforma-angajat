import type { SsmTrainingPlanItem, SsmTrainingPlanStatus } from "@repo/shared-types/ssm";
import { trainingCategoryLabel } from "@repo/shared-types/ssm-training-catalog";

export type EmployeePortalTab =
  | "home"
  | "trainings"
  | "documents"
  | "dossier"
  | "announcements"
  | "surveys"
  | "tickets";

export const PORTAL_TAB_LABELS: Record<EmployeePortalTab, string> = {
  home: "Acasă",
  trainings: "Instruiri",
  documents: "Documente",
  dossier: "Dosarul meu",
  announcements: "Anunțuri",
  surveys: "Sondaje",
  tickets: "Solicitări"
};

export function planStatusLabel(status: SsmTrainingPlanStatus): string {
  switch (status) {
    case "PENDING":
      return "De parcurs";
    case "COMPLETED":
      return "Finalizată";
    case "OVERDUE":
      return "Expirată";
    case "BLOCKED":
      return "Nevalidată";
    default:
      return status;
  }
}

export function planStatusClass(status: SsmTrainingPlanStatus): string {
  if (status === "COMPLETED") return "ssm-chip good";
  if (status === "OVERDUE" || status === "BLOCKED") return "ssm-chip bad";
  return "ssm-chip warn";
}

export function planCategoryLabel(plan: SsmTrainingPlanItem): string {
  return plan.trainingTypeCategory
    ? trainingCategoryLabel(plan.trainingTypeCategory)
    : plan.trainingTypeName;
}

export function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function formatRoDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString("ro-RO") : "—";
}

export function formatRoDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString("ro-RO") : "—";
}
