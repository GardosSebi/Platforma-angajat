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

export function planHasMaterial(plan: Pick<SsmTrainingPlanItem, "materialTitle" | "materialUrl">): boolean {
  return Boolean(plan.materialUrl?.trim() || plan.materialTitle?.trim());
}

export function trainingStep(plan: SsmTrainingPlanItem): number {
  if (plan.responsibleSignedAt) return 6;
  if (plan.trainingTypeCategory === "WORKPLACE" && plan.managerSignedAt) return 5;
  if (plan.employeeSignedAt) return 4;
  if (plan.score != null && plan.status !== "BLOCKED") return 3;
  if (plan.materialCompletedAt || !planHasMaterial(plan)) return 2;
  return plan.materialUrl || plan.materialTitle ? 1 : 2;
}

export function planWorkflowLabel(plan: SsmTrainingPlanItem): string {
  if (plan.status === "COMPLETED" || plan.responsibleSignedAt) {
    return "Finalizată";
  }
  if (plan.status === "BLOCKED") {
    return "Nevalidată";
  }
  if (plan.status === "OVERDUE") {
    return "Expirată";
  }
  if (plan.employeeSignedAt && !plan.responsibleSignedAt) {
    if (plan.trainingTypeCategory === "WORKPLACE" && !plan.managerSignedAt) {
      return "Așteaptă aprobare manager";
    }
    return "Așteaptă validare SSM";
  }
  if (plan.score != null) {
    return "De semnat";
  }
  if (plan.materialCompletedAt || !planHasMaterial(plan)) {
    return "Test de parcurs";
  }
  return planStatusLabel(plan.status);
}

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

export function planWorkflowClass(plan: SsmTrainingPlanItem): string {
  if (plan.status === "COMPLETED" || plan.responsibleSignedAt) return "ssm-chip good";
  if (plan.status === "OVERDUE" || plan.status === "BLOCKED") return "ssm-chip bad";
  if (plan.score != null || plan.employeeSignedAt) return "ssm-chip warn";
  return planStatusClass(plan.status);
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
