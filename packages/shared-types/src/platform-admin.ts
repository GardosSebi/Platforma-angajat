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

export interface UsageSummaryResponse {
  period: { from: string; to: string };
  auditEventsByModule: Array<{ module: string; events: number }>;
  distinctUsersWithAuditActions: number;
  totals: {
    users: number;
    employees: number;
    activeUsersInPeriod: number;
    helpdeskTicketsCreatedInPeriod: number;
    surveyResponsesInPeriod: number;
    announcementsPublishedInPeriod: number;
    announcementReadsInPeriod: number;
  };
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

export interface EmployeeTeamMemberSummary {
  id: string;
  fullName: string;
  email: string;
  jobPositionName: string | null;
  isSelf: boolean;
}

export interface EmployeeMyGroupSummary {
  id: string;
  name: string;
  description: string | null;
  members: EmployeeTeamMemberSummary[];
}

export interface DirectoryMemberSummary {
  employeeId: string;
  fullName: string;
  email: string;
  jobPositionName: string | null;
  departmentName: string | null;
  /** Roluri cont platformă (dacă e-mailul e legat de un user). */
  platformRoles: string[];
  isSelf: boolean;
}

export interface WorksiteDirectoryGroup {
  worksite: { id: string; code: string; name: string } | null;
  members: DirectoryMemberSummary[];
}

export interface PlatformAdministratorSummary {
  userId: string;
  email: string;
  fullName: string | null;
  roles: string[];
  employeeId: string | null;
  employeeFullName: string | null;
  worksiteName: string | null;
  isSelf: boolean;
}

export interface EmployeeDirectoryResponse {
  worksites: WorksiteDirectoryGroup[];
  administrators: PlatformAdministratorSummary[];
  totals: { employees: number; administrators: number; worksites: number };
}

export interface EmployeeMyContextResponse {
  /** Vizibilitate limitată la același punct de lucru (responsabil SSM, manager, angajat). */
  worksiteRestricted: boolean;
  linked: boolean;
  employee: {
    id: string;
    fullName: string;
    email: string;
    worksite: { id: string; code: string; name: string } | null;
    department: { id: string; code: string; name: string } | null;
    jobPosition: { id: string; code: string; name: string } | null;
  } | null;
  /** Colegi din același departament (dacă ești alocat la un departament). */
  departmentTeam: {
    department: { id: string; code: string; name: string };
    members: EmployeeTeamMemberSummary[];
  } | null;
  /** Grupuri de angajați din care faci parte. */
  groups: EmployeeMyGroupSummary[];
}
