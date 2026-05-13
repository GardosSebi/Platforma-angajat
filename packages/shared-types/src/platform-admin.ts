export interface TenantUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  active: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserScopedRoleRow {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  scope: string;
  worksiteId: string | null;
  employeeGroupId: string | null;
  createdAt: string;
  createdByUserId: string;
  worksite: { id: string; code: string; name: string } | null;
  employeeGroup: { id: string; name: string } | null;
}

export interface EmployeeStaticPageRow {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  audienceType: string;
  audienceRefId: string | null;
  sortOrder: number;
  published: boolean;
  attachmentName: string | null;
  attachmentPath: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeStaticPageListItem {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  audienceType: string;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  updatedAt: string;
}

export interface UsageSummaryResponse {
  period: { from: string; to: string };
  auditEventsByModule: { module: string; events: number }[];
  distinctUsersWithAuditActions: number;
  totals: {
    users: number;
    employees: number;
    helpdeskTicketsCreatedInPeriod: number;
    surveyResponsesInPeriod: number;
  };
}
