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
  canChat: boolean;
  canCommunicateExternal: boolean;
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
  canChat?: boolean;
  canCommunicateExternal?: boolean;
}

export interface MyCommunicationRights {
  canPublish: boolean;
  canChat: boolean;
  canCommunicateExternal: boolean;
  canManageTemplates: boolean;
  canManageRights: boolean;
}

export const EXTERNAL_CONTACT_KINDS = ["CONTRACTOR", "PARTNER", "EXTERNAL_SERVICE", "OTHER"] as const;
export type ExternalContactKind = (typeof EXTERNAL_CONTACT_KINDS)[number];

export const EXTERNAL_CONTACT_KIND_LABELS: Record<ExternalContactKind, string> = {
  CONTRACTOR: "Contractant",
  PARTNER: "Partener",
  EXTERNAL_SERVICE: "Serviciu extern",
  OTHER: "Altul"
};

export interface ExternalContactRow {
  id: string;
  kind: ExternalContactKind;
  organization: string;
  fullName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExternalContactRequest {
  kind?: ExternalContactKind;
  organization: string;
  fullName: string;
  email: string;
  phone?: string;
  notes?: string;
  active?: boolean;
}

export const COMMUNICATION_CHAT_CHANNEL_KINDS = ["ALL", "COMPANY", "GROUP", "WORKSITE", "EXTERNAL"] as const;
export type CommunicationChatChannelKind = (typeof COMMUNICATION_CHAT_CHANNEL_KINDS)[number];

export interface CommunicationChatChannelRow {
  id: string;
  kind: CommunicationChatChannelKind;
  name: string;
  legalEntityId?: string | null;
  employeeGroupId?: string | null;
  worksiteId?: string | null;
  externalContactId?: string | null;
  externalContact?: { id: string; fullName: string; organization: string; email: string } | null;
  updatedAt: string;
}

export interface CommunicationChatMessageRow {
  id: string;
  channelId: string;
  authorUserId: string;
  authorName?: string | null;
  body: string;
  emailedTo?: string | null;
  createdAt: string;
  mine?: boolean;
}
