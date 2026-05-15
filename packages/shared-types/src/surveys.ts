export const SURVEY_QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SCALE", "TEXT", "LONG_TEXT", "DATE", "BOOLEAN"] as const;
export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export const SURVEY_AUDIENCE_TYPES = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE_GROUP", "EMPLOYEE", "CUSTOM"] as const;
export type SurveyAudienceType = (typeof SURVEY_AUDIENCE_TYPES)[number];

export type SurveyStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
export type SurveyAnswerValue = string | number | boolean | string[] | null;

export interface SurveyQuestionOption {
  value: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  title: string;
  required?: boolean;
  options?: SurveyQuestionOption[];
  min?: number;
  max?: number;
}

export interface SurveyConditionalRule {
  questionId: string;
  operator: "EQUALS" | "NOT_EQUALS" | "INCLUDES" | "GREATER_THAN" | "LESS_THAN";
  value: SurveyAnswerValue;
  showQuestionId: string;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  audienceType?: SurveyAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  questionSchema: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[];
  privateLinkEnabled?: boolean;
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  status?: SurveyStatus;
  audienceType?: SurveyAudienceType;
  audienceRefId?: string;
  audienceLabel?: string;
  targetEmployeeIds?: string[];
  questionSchema?: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[];
  privateLinkEnabled?: boolean;
}

export interface SurveyItem {
  id: string;
  title: string;
  description?: string | null;
  status: SurveyStatus;
  audienceType: SurveyAudienceType;
  audienceRefId?: string | null;
  audienceLabel?: string | null;
  targetEmployeeIds: string[];
  questionSchema: SurveyQuestion[];
  conditionalLogic?: SurveyConditionalRule[] | null;
  privateLinkEnabled: boolean;
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
  /** Present on GET .../for-respond when the current user already submitted. */
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
