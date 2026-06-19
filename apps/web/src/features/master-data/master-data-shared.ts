export type MasterDataTab = "worksites" | "departments" | "positions";

export function activeLabel(active: boolean): string {
  return active ? "Activ" : "Inactiv";
}

export function activeTone(active: boolean): "good" | "bad" {
  return active ? "good" : "bad";
}

export function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}
