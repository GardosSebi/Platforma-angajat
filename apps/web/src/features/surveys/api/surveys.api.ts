import type {
  CreateSurveyPublicLinkRequest,
  CreateSurveyRequest,
  SubmitSurveyResponseRequest,
  SurveyItem,
  SurveyPublicLinkResponse,
  SurveyStatsResponse,
  UpdateSurveyRequest
} from "@repo/shared-types/surveys";
import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";
import { getApiBaseUrl } from "../../../shared/api/api-base";
import { httpClient } from "../../../shared/api/http-client";
import { httpErrorFromResponse } from "../../../shared/api/http-error";

export interface SurveysOverviewResponse {
  kpi: {
    activeSurveys: number;
    draftSurveys: number;
    totalResponses: number;
    publicLinks: number;
  };
  latestSurveys: SurveyItem[];
}

export interface SurveyAnswerFileUploadResponse {
  fileId: string;
  path: string;
  fileName: string;
  size: number;
  /** Stored answer format: `path|originalName` */
  answerValue: string;
}

export const surveysApi = {
  overview() {
    return httpClient<SurveysOverviewResponse>("/surveys/overview");
  },
  listSurveys(params?: PaginationParams) {
    return httpClient<PaginatedResult<SurveyItem>>(`/surveys${buildPaginationQuery(params)}`);
  },
  getForRespond(surveyId: string) {
    return httpClient<SurveyItem>(`/surveys/${surveyId}/for-respond`);
  },
  respondedSurveyIds() {
    return httpClient<{ surveyIds: string[] }>("/surveys/responded-ids");
  },
  createSurvey(payload: CreateSurveyRequest) {
    return httpClient<SurveyItem>("/surveys", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateSurvey(id: string, payload: UpdateSurveyRequest) {
    return httpClient<SurveyItem>(`/surveys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  activateSurvey(id: string) {
    return httpClient<SurveyItem>(`/surveys/${id}/activate`, {
      method: "PATCH"
    });
  },
  closeSurvey(id: string) {
    return httpClient<SurveyItem>(`/surveys/${id}/close`, {
      method: "PATCH"
    });
  },
  privateLink(id: string) {
    return httpClient<{ url: string; surveyId: string }>(`/surveys/${id}/private-link`, {
      method: "POST"
    });
  },
  publicLink(id: string, payload: CreateSurveyPublicLinkRequest) {
    return httpClient<SurveyPublicLinkResponse>(`/surveys/${id}/public-link`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  submitResponse(id: string, payload: SubmitSurveyResponseRequest) {
    return httpClient<{ responseId: string }>(`/surveys/${id}/responses`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listAvailableSurveys() {
    return httpClient<{ items: Array<{ id: string; title: string; description: string | null; alreadyResponded: boolean }> }>(
      "/surveys/available"
    );
  },
  stats(id: string) {
    return httpClient<SurveyStatsResponse>(`/surveys/${id}/stats`);
  },
  getExportUrl(id: string, type: "json" | "xlsx" | "pdf") {
    return `/surveys/${id}/export.${type}`;
  },
  uploadAnswerFile(surveyId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return httpClient<SurveyAnswerFileUploadResponse>(`/surveys/${surveyId}/upload-answer-file`, {
      method: "POST",
      body
    });
  }
};

export async function fetchPublicSurvey(token: string): Promise<SurveyItem> {
  const response = await fetch(`${getApiBaseUrl()}/surveys/public/${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }
  return response.json() as Promise<SurveyItem>;
}

export async function submitPublicSurveyResponse(token: string, payload: SubmitSurveyResponseRequest): Promise<{ responseId: string }> {
  const response = await fetch(`${getApiBaseUrl()}/surveys/public/${encodeURIComponent(token)}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }
  return response.json() as Promise<{ responseId: string }>;
}

export async function uploadPublicAnswerFile(token: string, file: File): Promise<SurveyAnswerFileUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${getApiBaseUrl()}/surveys/public/${encodeURIComponent(token)}/upload-answer-file`, {
    method: "POST",
    body
  });
  if (!response.ok) {
    throw await httpErrorFromResponse(response);
  }
  return response.json() as Promise<SurveyAnswerFileUploadResponse>;
}
