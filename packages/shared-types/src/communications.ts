export const COMMUNICATION_CONTENT_TYPES = [
  "TEXT",
  "RICH_TEXT",
  "LINK",
  "DOCUMENT",
  "SURVEY",
  "IMAGE",
  "VIDEO",
  "SLIDE",
  "BUTTON"
] as const;
export type CommunicationContentType = (typeof COMMUNICATION_CONTENT_TYPES)[number];

export const COMMUNICATION_MESSAGE_TYPES = ["ANNOUNCEMENT", "QUESTION", "READ_CONFIRMATION"] as const;
export type CommunicationMessageType = (typeof COMMUNICATION_MESSAGE_TYPES)[number];

export const COMMUNICATION_MESSAGE_TYPE_LABELS: Record<CommunicationMessageType, string> = {
  ANNOUNCEMENT: "Anunț",
  QUESTION: "Întrebare",
  READ_CONFIRMATION: "Anunț cu confirmare citire"
};

export const COMMUNICATION_REACTIONS = ["THUMBS_UP", "HEART", "CLAP", "CHECK"] as const;
export type CommunicationReaction = (typeof COMMUNICATION_REACTIONS)[number];

export const COMMUNICATION_REACTION_LABELS: Record<CommunicationReaction, string> = {
  THUMBS_UP: "👍",
  HEART: "❤️",
  CLAP: "👏",
  CHECK: "✅"
};

export interface CommunicationTranslation {
  title: string;
  body: string;
}

export type CommunicationTranslations = Record<string, CommunicationTranslation>;

export const COMMUNICATION_CATEGORIES = [
  "GENERAL",
  "SAFETY_ALERT",
  "POLICY",
  "TRAINING_INFO",
  "SSM_COMPLIANCE",
  "HR_INFO"
] as const;
export type CommunicationCategory = (typeof COMMUNICATION_CATEGORIES)[number];

export const COMMUNICATION_CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  GENERAL: "General",
  SAFETY_ALERT: "Alertă SSM / siguranță",
  POLICY: "Politică / procedură",
  TRAINING_INFO: "Instruire / informare",
  SSM_COMPLIANCE: "Conformitate SSM",
  HR_INFO: "Informare HR"
};

export const COMMUNICATION_AUDIENCE_TYPES = [
  "ALL",
  "WORKSITE",
  "DEPARTMENT",
  "JOB_POSITION",
  "EMPLOYEE_GROUP",
  "EMPLOYEE",
  "CUSTOM"
] as const;
export type CommunicationAudienceType = (typeof COMMUNICATION_AUDIENCE_TYPES)[number];

export type CommunicationAnnouncementStatus =
  | "DRAFT"
  | "READY_TO_SEND"
  | "SCHEDULED"
  | "PUBLISHED"
  | "RETRACTED"
  | "ARCHIVED";

export interface CreateCommunicationAnnouncementRequest {
  title: string;
  body: string;
  category?: CommunicationCategory;
  contentType?: CommunicationContentType;
  contentUrl?: string;
  messageType?: CommunicationMessageType;
  requireReadConfirmation?: boolean;
  linkedSurveyId?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  translations?: CommunicationTranslations;
  reactionsEnabled?: boolean;
  audienceType: CommunicationAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  status?: "DRAFT" | "PUBLISHED" | "READY_TO_SEND";
  publishAt?: string;
  expiresAt?: string;
  reminderAt?: string;
  templateId?: string;
}

export interface UpdateCommunicationAnnouncementRequest {
  title?: string;
  body?: string;
  category?: CommunicationCategory;
  contentType?: CommunicationContentType;
  contentUrl?: string;
  messageType?: CommunicationMessageType;
  requireReadConfirmation?: boolean;
  linkedSurveyId?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  translations?: CommunicationTranslations;
  reactionsEnabled?: boolean;
  audienceType?: CommunicationAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  status?: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "READY_TO_SEND" | "ARCHIVED";
  publishAt?: string;
  expiresAt?: string;
  reminderAt?: string;
}

export interface CommunicationAnnouncementItem {
  id: string;
  title: string;
  body: string;
  category: CommunicationCategory;
  contentType: CommunicationContentType;
  contentUrl?: string | null;
  messageType: CommunicationMessageType;
  requireReadConfirmation: boolean;
  linkedSurveyId?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  translations?: CommunicationTranslations | null;
  reactionsEnabled: boolean;
  audienceType: CommunicationAudienceType;
  audienceRefId?: string | null;
  audienceLabel?: string | null;
  targetEmployeeIds: string[];
  status: CommunicationAnnouncementStatus;
  publishAt?: string | null;
  expiresAt?: string | null;
  reminderAt?: string | null;
  lastReminderSentAt?: string | null;
  templateId?: string | null;
  duplicatedFromId?: string | null;
  retractedAt?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    targetCount: number;
    readCount: number;
    unreadCount: number;
    readRate: number;
    reactionCount?: number;
  };
}

export interface CommunicationCalendarEntry {
  id: string;
  title: string;
  status: CommunicationAnnouncementStatus;
  publishAt: string;
  audienceLabel?: string | null;
}

export interface CommunicationDashboardResponse {
  kpi: {
    digitalizationRate: number;
    activeEmployees: number;
    activeUsers: number;
    activeAnnouncements: number;
    scheduledAnnouncements: number;
    readRate: number;
    unreadEstimate: number;
  };
  latestAnnouncements: CommunicationAnnouncementItem[];
  reminders: CommunicationReminderItem[];
  calendar: CommunicationCalendarEntry[];
}

export interface CommunicationReminderItem {
  announcementId: string;
  title: string;
  reminderAt: string;
  status: CommunicationAnnouncementStatus;
  readRate: number;
  unreadCount: number;
  lastReminderSentAt?: string | null;
}

export interface CommunicationTemplateItem {
  id: string;
  name: string;
  title: string;
  body: string;
  category: CommunicationCategory;
  contentType: CommunicationContentType;
  contentUrl?: string | null;
  audienceType: CommunicationAudienceType;
  audienceRefId?: string | null;
  audienceLabel?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunicationTemplateRequest {
  name: string;
  title: string;
  body: string;
  category?: CommunicationCategory;
  contentType?: CommunicationContentType;
  contentUrl?: string;
  audienceType?: CommunicationAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  active?: boolean;
}

export interface MarkCommunicationReadRequest {
  employeeId: string;
}

export interface SetCommunicationReactionRequest {
  employeeId: string;
  reaction: CommunicationReaction;
}
