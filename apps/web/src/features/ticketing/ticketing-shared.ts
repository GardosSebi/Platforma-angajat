import type { HelpdeskTicketPriority, HelpdeskTicketSource, HelpdeskTicketStatus } from "@repo/shared-types/ticketing";
import { HELPDESK_TICKET_STATUSES } from "@repo/shared-types/ticketing";

export const STATUSES = [...HELPDESK_TICKET_STATUSES] as HelpdeskTicketStatus[];

export const STATUS_LABELS: Record<HelpdeskTicketStatus, string> = {
  OPEN: "Deschis",
  WAITING_OPERATOR: "Așteptare operator",
  WAITING_USER: "Așteptare utilizator",
  WAITING_INFO: "Așteptare informații",
  CLOSED: "Închis"
};

export const PRIORITY_LABELS: Record<HelpdeskTicketPriority, string> = {
  LOW: "Scăzută",
  MEDIUM: "Medie",
  HIGH: "Ridicată",
  URGENT: "Urgentă"
};

export const SOURCE_LABELS: Record<HelpdeskTicketSource, string> = {
  PORTAL: "Portal",
  SURVEY: "Sondaj",
  CHATBOT: "Chatbot",
  EMAIL: "Email",
  MANUAL: "Manual"
};

export const TICKET_CATEGORIES = ["HR", "CONCEDIU", "IT", "LEGAL", "FACILITĂȚI", "ALTE"] as const;

export type TicketingTab = "board" | "create" | "stats";

export type TicketViewMode = "kanban" | "list";

export function formatTicketDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function priorityTone(priority: HelpdeskTicketPriority): "good" | "warn" | "bad" {
  if (priority === "URGENT" || priority === "HIGH") return "bad";
  if (priority === "MEDIUM") return "warn";
  return "good";
}

export function statusTone(status: HelpdeskTicketStatus): "good" | "warn" | "bad" {
  if (status === "CLOSED") return "bad";
  if (status === "OPEN") return "good";
  return "warn";
}

export function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}
