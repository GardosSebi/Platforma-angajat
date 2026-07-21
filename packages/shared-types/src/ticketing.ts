export const HELPDESK_TICKET_STATUSES = [
  "OPEN",
  "WAITING_OPERATOR",
  "WAITING_USER",
  "WAITING_INFO",
  "CLOSED"
] as const;
export type HelpdeskTicketStatus = (typeof HELPDESK_TICKET_STATUSES)[number];

export const HELPDESK_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type HelpdeskTicketPriority = (typeof HELPDESK_TICKET_PRIORITIES)[number];

export const HELPDESK_TICKET_SOURCES = ["PORTAL", "SURVEY", "CHATBOT", "EMAIL", "MANUAL"] as const;
export type HelpdeskTicketSource = (typeof HELPDESK_TICKET_SOURCES)[number];

export interface CreateHelpdeskTicketRequest {
  title: string;
  description: string;
  category?: string;
  priority?: HelpdeskTicketPriority;
  source?: HelpdeskTicketSource;
  reporterEmployeeId?: string;
  reporterName?: string;
  reporterEmail?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  sourceSurveyResponseId?: string;
  dueAt?: string;
}

export interface CreateHelpdeskTicketFromEmailRequest {
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  category?: string;
  priority?: HelpdeskTicketPriority;
  messageId?: string;
}

export interface UpdateHelpdeskTicketRequest {
  title?: string;
  description?: string;
  category?: string;
  status?: HelpdeskTicketStatus;
  priority?: HelpdeskTicketPriority;
  reporterEmployeeId?: string;
  reporterName?: string;
  reporterEmail?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  dueAt?: string;
}

export interface HelpdeskTicketItem {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  status: HelpdeskTicketStatus;
  priority: HelpdeskTicketPriority;
  source: HelpdeskTicketSource;
  reporterEmployeeId?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  sourceSurveyResponseId?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
}

export interface HelpdeskTicketCommentItem {
  id: string;
  ticketId: string;
  body: string;
  internal: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CreateHelpdeskTicketCommentRequest {
  body: string;
  internal?: boolean;
}

export interface HelpdeskKanbanResponse {
  columns: Array<{
    status: HelpdeskTicketStatus;
    tickets: HelpdeskTicketItem[];
  }>;
}

export interface HelpdeskStatsResponse {
  total: number;
  open: number;
  overdue: number;
  byStatus: Array<{ status: HelpdeskTicketStatus; count: number }>;
  byPriority: Array<{ priority: HelpdeskTicketPriority; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  operators: Array<{ assignedToUserId: string; assignedToName?: string | null; count: number }>;
}
