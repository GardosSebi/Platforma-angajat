import type {
  CommunicationPublishRightRow,
  CreateCommunicationPublishRightRequest
} from "@repo/shared-types/communication-rights";
import type {
  CommunicationAnnouncementItem,
  CommunicationCalendarEntry,
  CommunicationDashboardResponse,
  CommunicationReaction,
  CommunicationReminderItem,
  CommunicationTemplateItem,
  CreateCommunicationAnnouncementRequest,
  CreateCommunicationTemplateRequest,
  MarkCommunicationReadRequest,
  SetCommunicationReactionRequest,
  UpdateCommunicationAnnouncementRequest
} from "@repo/shared-types/communications";
import type { UsageSummaryResponse } from "@repo/shared-types/platform-admin";
import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";
import { httpClient } from "../../../shared/api/http-client";

export const chatbotApi = {
  dashboard() {
    return httpClient<CommunicationDashboardResponse>("/chatbot/overview");
  },
  listAnnouncements(params?: PaginationParams) {
    return httpClient<PaginatedResult<CommunicationAnnouncementItem>>(
      `/chatbot/announcements${buildPaginationQuery(params)}`
    );
  },
  getAnnouncement(id: string) {
    return httpClient<CommunicationAnnouncementItem>(`/chatbot/announcements/${id}`);
  },
  createAnnouncement(payload: CreateCommunicationAnnouncementRequest) {
    return httpClient<CommunicationAnnouncementItem>("/chatbot/announcements", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateAnnouncement(id: string, payload: UpdateCommunicationAnnouncementRequest) {
    return httpClient<CommunicationAnnouncementItem>(`/chatbot/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  publishAnnouncement(id: string) {
    return httpClient<CommunicationAnnouncementItem>(`/chatbot/announcements/${id}/publish`, {
      method: "PATCH"
    });
  },
  retractAnnouncement(id: string) {
    return httpClient<CommunicationAnnouncementItem>(`/chatbot/announcements/${id}/retract`, {
      method: "PATCH"
    });
  },
  duplicateAnnouncement(id: string) {
    return httpClient<CommunicationAnnouncementItem>(`/chatbot/announcements/${id}/duplicate`, {
      method: "POST"
    });
  },
  deleteAnnouncement(id: string) {
    return httpClient<{ ok: true }>(`/chatbot/announcements/${id}`, {
      method: "DELETE"
    });
  },
  markAnnouncementRead(id: string, payload: MarkCommunicationReadRequest) {
    return httpClient(`/chatbot/announcements/${id}/read`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  setAnnouncementReaction(id: string, payload: SetCommunicationReactionRequest) {
    return httpClient(`/chatbot/announcements/${id}/reaction`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  calendar() {
    return httpClient<{ items: CommunicationCalendarEntry[] }>("/chatbot/calendar");
  },
  usageSummary(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    return httpClient<UsageSummaryResponse>(`/admin/usage/summary${q ? `?${q}` : ""}`);
  },
  reminders() {
    return httpClient<CommunicationReminderItem[]>("/chatbot/reminders");
  },
  dispatchReminders() {
    return httpClient<{ sent: number }>("/chatbot/reminders/dispatch", {
      method: "POST"
    });
  },
  listTemplates() {
    return httpClient<{ items: CommunicationTemplateItem[] }>("/chatbot/templates");
  },
  createTemplate(payload: CreateCommunicationTemplateRequest) {
    return httpClient<CommunicationTemplateItem>("/chatbot/templates", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listPublishRights() {
    return httpClient<CommunicationPublishRightRow[]>("/chatbot/publish-rights");
  },
  createPublishRight(payload: CreateCommunicationPublishRightRequest) {
    return httpClient<CommunicationPublishRightRow>("/chatbot/publish-rights", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  deletePublishRight(id: string) {
    return httpClient<{ deleted: true }>(`/chatbot/publish-rights/${id}`, {
      method: "DELETE"
    });
  }
};
