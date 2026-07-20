export const COMMUNICATION_PUBLISH_SCOPES = ["ALL", "LEGAL_ENTITY", "EMPLOYEE_GROUP", "WORKSITE"] as const;
export type CommunicationPublishScope = (typeof COMMUNICATION_PUBLISH_SCOPES)[number];

export interface CommunicationPublishRightRow {
  id: string;
  tenantId: string;
  userId: string;
  scopeType: CommunicationPublishScope;
  legalEntityId: string | null;
  employeeGroupId: string | null;
  worksiteId: string | null;
  canPublish: boolean;
  canManageTemplates: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; fullName: string | null } | null;
  legalEntity?: { id: string; code: string; name: string } | null;
  employeeGroup?: { id: string; name: string } | null;
  worksite?: { id: string; code: string; name: string } | null;
}

export interface CreateCommunicationPublishRightRequest {
  userId: string;
  scopeType: CommunicationPublishScope;
  legalEntityId?: string | null;
  employeeGroupId?: string | null;
  worksiteId?: string | null;
  canPublish?: boolean;
  canManageTemplates?: boolean;
}
