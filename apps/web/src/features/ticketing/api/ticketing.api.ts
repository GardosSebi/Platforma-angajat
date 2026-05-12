import type {
  CreateHelpdeskTicketCommentRequest,
  CreateHelpdeskTicketRequest,
  HelpdeskKanbanResponse,
  HelpdeskStatsResponse,
  HelpdeskTicketCommentItem,
  HelpdeskTicketItem,
  HelpdeskTicketPriority,
  HelpdeskTicketStatus,
  UpdateHelpdeskTicketRequest
} from "@repo/shared-types/ticketing";
import { httpClient } from "../../../shared/api/http-client";

export interface TicketFilters {
  status?: HelpdeskTicketStatus;
  priority?: HelpdeskTicketPriority;
  assignedToUserId?: string;
  reporterEmployeeId?: string;
  category?: string;
  search?: string;
}

function queryString(filters?: TicketFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export const ticketingApi = {
  kanban(filters?: TicketFilters) {
    return httpClient<HelpdeskKanbanResponse>(`/ticketing/kanban${queryString(filters)}`);
  },
  listTickets(filters?: TicketFilters) {
    return httpClient<{ items: HelpdeskTicketItem[] }>(`/ticketing/tickets${queryString(filters)}`);
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
