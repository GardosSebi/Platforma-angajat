import type {
  CreateHelpdeskTicketCommentRequest,
  CreateHelpdeskTicketFromEmailRequest,
  CreateHelpdeskTicketRequest,
  HelpdeskKanbanResponse,
  HelpdeskStatsResponse,
  HelpdeskTicketCommentItem,
  HelpdeskTicketItem,
  HelpdeskTicketPriority,
  HelpdeskTicketStatus,
  UpdateHelpdeskTicketRequest
} from "@repo/shared-types/ticketing";
import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";
import { httpClient } from "../../../shared/api/http-client";

export interface TicketFilters extends PaginationParams {
  status?: HelpdeskTicketStatus;
  priority?: HelpdeskTicketPriority;
  assignedToUserId?: string;
  assignedToName?: string;
  reporterEmployeeId?: string;
  category?: string;
  subject?: string;
  search?: string;
}

function queryString(filters?: TicketFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export const ticketingApi = {
  kanban(filters?: TicketFilters) {
    return httpClient<HelpdeskKanbanResponse>(`/ticketing/kanban${queryString(filters)}`);
  },
  listTickets(filters?: TicketFilters) {
    return httpClient<PaginatedResult<HelpdeskTicketItem>>(`/ticketing/tickets${queryString(filters)}`);
  },
  createTicket(payload: CreateHelpdeskTicketRequest) {
    return httpClient<HelpdeskTicketItem>("/ticketing/tickets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createTicketFromSurvey(payload: CreateHelpdeskTicketRequest) {
    return httpClient<HelpdeskTicketItem>("/ticketing/tickets/from-survey-response", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createTicketFromEmail(payload: CreateHelpdeskTicketFromEmailRequest) {
    return httpClient<HelpdeskTicketItem>("/ticketing/tickets/from-email", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateTicket(id: string, payload: UpdateHelpdeskTicketRequest) {
    return httpClient<HelpdeskTicketItem>(`/ticketing/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  moveTicket(id: string, status: HelpdeskTicketStatus) {
    return httpClient<HelpdeskTicketItem>(`/ticketing/tickets/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },
  assignTicket(id: string, assignedToUserId: string, assignedToName?: string) {
    return httpClient<HelpdeskTicketItem>(`/ticketing/tickets/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedToUserId, assignedToName })
    });
  },
  comments(id: string) {
    return httpClient<{ items: HelpdeskTicketCommentItem[] }>(`/ticketing/tickets/${id}/comments`);
  },
  addComment(id: string, payload: CreateHelpdeskTicketCommentRequest) {
    return httpClient<HelpdeskTicketCommentItem>(`/ticketing/tickets/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  stats() {
    return httpClient<HelpdeskStatsResponse>("/ticketing/stats");
  }
};
