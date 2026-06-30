export const SURVEY_QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "DROPDOWN",
  "MULTI_DROPDOWN",
  "SCALE",
  "TEXT",
  "LONG_TEXT",
  "MULTI_TEXT",
  "DATE",
  "BOOLEAN",
  "NUMBER",
  "RATING_NPS",
  "RANKING",
  "FILE_UPLOAD",
  "IMAGE_SELECT"
] as const;
export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: "Alegere unică (radio)",
  MULTIPLE_CHOICE: "Alegere multiplă (checkbox)",
  DROPDOWN: "Dropdown",
  MULTI_DROPDOWN: "Dropdown multi-select",
  SCALE: "Scală",
  TEXT: "Text scurt",
  LONG_TEXT: "Text lung",
  MULTI_TEXT: "Casete text multiple",
  DATE: "Dată",
  BOOLEAN: "Da / Nu",
  NUMBER: "Număr",
  RATING_NPS: "Scor NPS (0–10)",
  RANKING: "Clasament",
  FILE_UPLOAD: "Încărcare fișier",
  IMAGE_SELECT: "Selector imagini"
};

export function surveyQuestionNeedsOptions(type: SurveyQuestionType): boolean {
  return (
    type === "SINGLE_CHOICE" ||
    type === "MULTIPLE_CHOICE" ||
    type === "DROPDOWN" ||
    type === "MULTI_DROPDOWN" ||
    type === "RANKING" ||
    type === "IMAGE_SELECT"
  );
}

export const SURVEY_TYPES = ["ENGAGEMENT", "COMPLIANCE", "FEEDBACK", "EXIT", "PULSE", "CUSTOM"] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  ENGAGEMENT: "Angajare / satisfacție",
  COMPLIANCE: "Conformitate SSM",
  FEEDBACK: "Feedback",
  EXIT: "Părăsire companie",
  PULSE: "Pulse check",
  CUSTOM: "Personalizat"
};

export const SURVEY_AUDIENCE_TYPES = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE_GROUP", "EMPLOYEE", "CUSTOM"] as const;
export type SurveyAudienceType = (typeof SURVEY_AUDIENCE_TYPES)[number];

export type SurveyStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
export type SurveyAnswerValue = string | number | boolean | string[] | null;

export interface SurveyQuestionOption {
  value: string;
  label: string;
  imageUrl?: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  title: string;
  required?: boolean;
  options?: SurveyQuestionOption[];
  min?: number;
  max?: number;
  multiTextCount?: number;
}

export interface SurveyConditionalRule {
  questionId: string;
  operator: "EQUALS" | "NOT_EQUALS" | "INCLUDES" | "GREATER_THAN" | "LESS_THAN";
  value: SurveyAnswerValue;
  showQuestionId: string;
}

export interface SurveyTranslation {
  title: string;
  description?: string;
  questions?: Record<string, string>;
}

export type SurveyTranslations = Record<string, SurveyTranslation>;

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  surveyType?: SurveyType;
  audienceType?: SurveyAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  questionSchema: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[];
  translations?: SurveyTranslations;
  privateLinkEnabled?: boolean;
  anonymousMode?: boolean;
  emailNotifyOnPublish?: boolean;
  autoCreateTicket?: boolean;
  autoTicketTitle?: string;
  autoTicketCategory?: string;
  closesAt?: string;
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  surveyType?: SurveyType;
  status?: SurveyStatus;
  audienceType?: SurveyAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  questionSchema?: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[];
  translations?: SurveyTranslations;
  privateLinkEnabled?: boolean;
  anonymousMode?: boolean;
  emailNotifyOnPublish?: boolean;
  autoCreateTicket?: boolean;
  autoTicketTitle?: string;
  autoTicketCategory?: string;
  closesAt?: string;
}

export interface SurveyItem {
  id: string;
  title: string;
  description?: string | null;
  surveyType: SurveyType;
  status: SurveyStatus;
  closesAt?: string | null;
  audienceType: SurveyAudienceType;
  audienceRefId?: string | null;
  audienceLabel?: string | null;
  targetEmployeeIds: string[];
  questionSchema: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[] | null;
  translations?: SurveyTranslations | null;
  privateLinkEnabled: boolean;
  anonymousMode: boolean;
  emailNotifyOnPublish: boolean;
  autoCreateTicket: boolean;
  autoTicketTitle?: string | null;
  autoTicketCategory?: string | null;
  publicEnabled: boolean;
  publicExpiresAt?: string | null;
  publicResponseLimit?: number | null;
  publicResponseCount: number;
  createdAt: string;
  updatedAt: string;
  stats: {
    responseCount: number;
    questionCount: number;
    privateResponses: number;
    publicResponses: number;
  };
  alreadyResponded?: boolean;
  respondedAt?: string | null;
}

export interface SubmitSurveyResponseRequest {
  employeeId?: string;
  answers: Record<string, SurveyAnswerValue>;
}

export interface SurveyQuestionStats {
  questionId: string;
  title: string;
  type: SurveyQuestionType;
  responseCount: number;
  options?: Array<{ value: string; label: string; count: number }>;
  average?: number | null;
}

export interface SurveyStatsResponse {
  surveyId: string;
  title: string;
  responseCount: number;
  privateResponses: number;
  publicResponses: number;
  questionStats: SurveyQuestionStats[];
}

export interface SurveyPublicLinkResponse {
  url: string;
  token: string;
  expiresAt?: string | null;
  responseLimit?: number | null;
}

export interface CreateSurveyPublicLinkRequest {
  expiresAt: string;
  responseLimit?: number;
}
