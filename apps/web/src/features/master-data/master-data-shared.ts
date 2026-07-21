export type MasterDataTab =
  | "legal-entities"
  | "worksites"
  | "departments"
  | "positions"
  | "employees"
  | "groups"
  | "ssm-responsibles"
  | "import";

export interface LegalEntityWorksiteItem {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active: boolean;
}

export interface LegalEntityItem {
  id: string;
  code: string;
  name: string;
  cui?: string | null;
  headquarters?: string | null;
  active: boolean;
  worksites?: LegalEntityWorksiteItem[];
}

/** Etichete buton adăugare — „Adaugă” + numele secțiunii (fără „+”). */
export const MASTER_DATA_ADD_LABELS = {
  employees: "Adaugă angajat",
  "legal-entities": "Adaugă entitate juridică",
  worksites: "Adaugă punct de lucru",
  departments: "Adaugă departament",
  positions: "Adaugă post",
  groups: "Adaugă grup de instruire",
  "ssm-responsibles": "Adaugă responsabil SSM",
  import: "Import CSV"
} as const satisfies Record<MasterDataTab, string>;

export const ACTIVE_STATUS_OPTIONS = [
  { value: "true", label: "Activ" },
  { value: "false", label: "Inactiv" }
] as const;

export const ACTIVE_STATUS_CARD_OPTIONS = [
  {
    value: "true",
    title: "Activ",
    description: "Înregistrarea este folosită în liste, atribuiri și rapoarte."
  },
  {
    value: "false",
    title: "Inactiv",
    description: "Înregistrarea rămâne în sistem, dar nu se folosește la operațiuni noi."
  }
] as const;

export function activeLabel(active: boolean): string {
  return active ? "Activ" : "Inactiv";
}

export function activeTone(active: boolean): "good" | "bad" {
  return active ? "good" : "bad";
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO");
}

export const PLACEMENT_CHANGE_REASONS = [
  "Transfer",
  "Schimbare funcție",
  "Plecare",
  "Revenire",
  "Promovare",
  "Restructurare",
  "Altele"
] as const;

export function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}
