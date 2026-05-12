import type {
  CommunicationAnnouncementItem,
  CommunicationDashboardResponse,
  CommunicationReminderItem,
  CommunicationTemplateItem,
  CreateCommunicationAnnouncementRequest,
  CreateCommunicationTemplateRequest,
  MarkCommunicationReadRequest,
  UpdateCommunicationAnnouncementRequest
} from "@repo/shared-types/communications";
import { httpClient } from "../../../shared/api/http-client";

export const chatbotApi = {
  dashboard() {
    return httpClient<CommunicationDashboardResponse>("/chatbot/overview");
  },
  listAnnouncements() {
    return httpClient<{ items: CommunicationAnnouncementItem[] }>("/chatbot/announcements");
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
  markAnnouncementRead(id: string, payload: MarkCommunicationReadRequest) {
    return httpClient(`/chatbot/announcements/${id}/read`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
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
  }
};
