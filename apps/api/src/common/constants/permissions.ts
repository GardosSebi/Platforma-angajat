import { SystemRole } from "../prisma-enums";

export const Permission = {
  WILDCARD: "*",
  SSM_TRAINING_ASSIGN: "ssm:training:assign",
  SSM_DOCUMENT_VIEW: "ssm:documents:view",
  SSM_DOCUMENT_EDIT: "ssm:documents:edit",
  SSM_DOCUMENT_APPROVE: "ssm:documents:approve",
  SSM_TRAINING_VIEW: "ssm:training:view",
  SSM_TRAINING_EDIT: "ssm:training:edit",
  SSM_TRAINING_APPROVE: "ssm:training:approve",
  SSM_EIP_VIEW: "ssm:eip:view",
  SSM_EIP_EDIT: "ssm:eip:edit",
  SSM_EIP_APPROVE: "ssm:eip:approve",
  SSM_ACCIDENT_VIEW: "ssm:accident:view",
  SSM_ACCIDENT_EDIT: "ssm:accident:edit",
  SSM_ACCIDENT_APPROVE: "ssm:accident:approve",
  SSM_MEDICAL_VIEW: "ssm:medical:view",
  SSM_MEDICAL_EDIT: "ssm:medical:edit",
  SSM_MEDICAL_APPROVE: "ssm:medical:approve",
  SSM_RISK_VIEW: "ssm:risk:view",
  SSM_RISK_EDIT: "ssm:risk:edit",
  SSM_RISK_APPROVE: "ssm:risk:approve",
  SSM_PSI_VIEW: "ssm:psi:view",
  SSM_PSI_EDIT: "ssm:psi:edit",
  SSM_PSI_APPROVE: "ssm:psi:approve",
  SSM_DASHBOARD_VIEW: "ssm:dashboard:view",
  SSM_REPORT_VIEW: "ssm:reports:view",
  SSM_REPORT_EXPORT: "ssm:reports:export",
  COMMUNICATIONS_DASHBOARD_VIEW: "communications:dashboard:view",
  COMMUNICATIONS_ANNOUNCEMENTS_VIEW: "communications:announcements:view",
  COMMUNICATIONS_ANNOUNCEMENTS_EDIT: "communications:announcements:edit",
  COMMUNICATIONS_TEMPLATES_EDIT: "communications:templates:edit",
  SURVEYS_VIEW: "surveys:view",
  SURVEYS_EDIT: "surveys:edit",
  SURVEYS_RESPOND: "surveys:respond",
  SURVEYS_EXPORT: "surveys:export",
  TICKETS_VIEW: "ticketing:tickets:view",
  TICKETS_EDIT: "ticketing:tickets:edit",
  TICKETS_ASSIGN: "ticketing:tickets:assign",
  TICKETS_STATS: "ticketing:stats:view",
  FILES_UPLOAD: "files:upload",
  AUDIT_READ: "audit:read",
  MASTER_DATA_READ: "master-data:read",
  MASTER_DATA_WRITE: "master-data:write",
  MASTER_DATA_IMPORT: "master-data:import",
  ADMIN_USERS_VIEW: "admin:users:view",
  ADMIN_USERS_EDIT: "admin:users:edit",
  ADMIN_ROLE_SCOPE_MANAGE: "admin:role-scope:manage",
  STATIC_PAGES_MANAGE: "platform:static-pages:manage",
  USAGE_STATS_VIEW: "admin:usage:view"
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

const allPermissions: string[] = [
  Permission.SSM_TRAINING_ASSIGN,
  Permission.SSM_DOCUMENT_VIEW,
  Permission.SSM_DOCUMENT_EDIT,
  Permission.SSM_DOCUMENT_APPROVE,
  Permission.SSM_TRAINING_VIEW,
  Permission.SSM_TRAINING_EDIT,
  Permission.SSM_TRAINING_APPROVE,
  Permission.SSM_EIP_VIEW,
  Permission.SSM_EIP_EDIT,
  Permission.SSM_EIP_APPROVE,
  Permission.SSM_ACCIDENT_VIEW,
  Permission.SSM_ACCIDENT_EDIT,
  Permission.SSM_ACCIDENT_APPROVE,
  Permission.SSM_MEDICAL_VIEW,
  Permission.SSM_MEDICAL_EDIT,
  Permission.SSM_MEDICAL_APPROVE,
  Permission.SSM_RISK_VIEW,
  Permission.SSM_RISK_EDIT,
  Permission.SSM_RISK_APPROVE,
  Permission.SSM_PSI_VIEW,
  Permission.SSM_PSI_EDIT,
  Permission.SSM_PSI_APPROVE,
  Permission.SSM_DASHBOARD_VIEW,
  Permission.SSM_REPORT_VIEW,
  Permission.SSM_REPORT_EXPORT,
  Permission.COMMUNICATIONS_DASHBOARD_VIEW,
  Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW,
  Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
  Permission.COMMUNICATIONS_TEMPLATES_EDIT,
  Permission.SURVEYS_VIEW,
  Permission.SURVEYS_EDIT,
  Permission.SURVEYS_RESPOND,
  Permission.SURVEYS_EXPORT,
  Permission.TICKETS_VIEW,
  Permission.TICKETS_EDIT,
  Permission.TICKETS_ASSIGN,
  Permission.TICKETS_STATS,
  Permission.FILES_UPLOAD,
  Permission.AUDIT_READ,
  Permission.MASTER_DATA_READ,
  Permission.MASTER_DATA_WRITE,
  Permission.MASTER_DATA_IMPORT,
  Permission.ADMIN_USERS_VIEW,
  Permission.ADMIN_USERS_EDIT,
  Permission.ADMIN_ROLE_SCOPE_MANAGE,
  Permission.STATIC_PAGES_MANAGE,
  Permission.USAGE_STATS_VIEW
];

const masterDataReadWrite: string[] = [
  Permission.MASTER_DATA_READ,
  Permission.MASTER_DATA_WRITE,
  Permission.MASTER_DATA_IMPORT
];

export const ROLE_PERMISSIONS: Record<SystemRole, readonly string[]> = {
  [SystemRole.PLATFORM_ADMIN]: [Permission.WILDCARD],
  [SystemRole.TENANT_ADMIN]: allPermissions,
  [SystemRole.SSM_ADMIN]: [
    Permission.SSM_TRAINING_ASSIGN,
    Permission.SSM_DOCUMENT_VIEW,
    Permission.SSM_DOCUMENT_EDIT,
    Permission.SSM_DOCUMENT_APPROVE,
    Permission.SSM_TRAINING_VIEW,
    Permission.SSM_TRAINING_EDIT,
    Permission.SSM_TRAINING_APPROVE,
    Permission.SSM_EIP_VIEW,
    Permission.SSM_EIP_EDIT,
    Permission.SSM_EIP_APPROVE,
    Permission.SSM_ACCIDENT_VIEW,
    Permission.SSM_ACCIDENT_EDIT,
    Permission.SSM_ACCIDENT_APPROVE,
    Permission.SSM_MEDICAL_VIEW,
    Permission.SSM_MEDICAL_EDIT,
    Permission.SSM_MEDICAL_APPROVE,
    Permission.SSM_RISK_VIEW,
    Permission.SSM_RISK_EDIT,
    Permission.SSM_RISK_APPROVE,
    Permission.SSM_PSI_VIEW,
    Permission.SSM_PSI_EDIT,
    Permission.SSM_PSI_APPROVE,
    Permission.SSM_DASHBOARD_VIEW,
    Permission.SSM_REPORT_VIEW,
    Permission.SSM_REPORT_EXPORT,
    Permission.COMMUNICATIONS_DASHBOARD_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.COMMUNICATIONS_TEMPLATES_EDIT,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_EDIT,
    Permission.SURVEYS_RESPOND,
    Permission.SURVEYS_EXPORT,
    Permission.TICKETS_VIEW,
    Permission.TICKETS_EDIT,
    Permission.TICKETS_ASSIGN,
    Permission.TICKETS_STATS,
    Permission.FILES_UPLOAD,
    Permission.AUDIT_READ,
    ...masterDataReadWrite
  ],
  [SystemRole.SSM_ENTITY_RESPONSIBLE]: [
    Permission.SSM_TRAINING_ASSIGN,
    Permission.SSM_DOCUMENT_VIEW,
    Permission.SSM_DOCUMENT_EDIT,
    Permission.SSM_TRAINING_VIEW,
    Permission.SSM_TRAINING_EDIT,
    Permission.SSM_EIP_VIEW,
    Permission.SSM_EIP_EDIT,
    Permission.SSM_ACCIDENT_VIEW,
    Permission.SSM_ACCIDENT_EDIT,
    Permission.SSM_MEDICAL_VIEW,
    Permission.SSM_MEDICAL_EDIT,
    Permission.SSM_RISK_VIEW,
    Permission.SSM_RISK_EDIT,
    Permission.SSM_PSI_VIEW,
    Permission.SSM_PSI_EDIT,
    Permission.SSM_DASHBOARD_VIEW,
    Permission.SSM_REPORT_VIEW,
    Permission.SSM_REPORT_EXPORT,
    Permission.COMMUNICATIONS_DASHBOARD_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_EDIT,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_EDIT,
    Permission.SURVEYS_RESPOND,
    Permission.SURVEYS_EXPORT,
    Permission.TICKETS_VIEW,
    Permission.TICKETS_EDIT,
    Permission.TICKETS_ASSIGN,
    Permission.TICKETS_STATS,
    Permission.FILES_UPLOAD,
    Permission.MASTER_DATA_READ,
    Permission.MASTER_DATA_WRITE,
    Permission.MASTER_DATA_IMPORT
  ],
  [SystemRole.DEPARTMENT_MANAGER]: [
    Permission.SSM_TRAINING_ASSIGN,
    Permission.SSM_DOCUMENT_VIEW,
    Permission.SSM_TRAINING_VIEW,
    Permission.SSM_EIP_VIEW,
    Permission.SSM_ACCIDENT_VIEW,
    Permission.SSM_MEDICAL_VIEW,
    Permission.SSM_RISK_VIEW,
    Permission.SSM_PSI_VIEW,
    Permission.SSM_DASHBOARD_VIEW,
    Permission.SSM_REPORT_VIEW,
    Permission.COMMUNICATIONS_DASHBOARD_VIEW,
    Permission.COMMUNICATIONS_ANNOUNCEMENTS_VIEW,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_RESPOND,
    Permission.TICKETS_VIEW,
    Permission.TICKETS_EDIT,
    Permission.MASTER_DATA_READ
  ],
  [SystemRole.EMPLOYEE]: [Permission.SURVEYS_RESPOND]
};

export function permissionsForRoles(roles: SystemRole[]): Set<string> {
  const set = new Set<string>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role]) {
      set.add(p);
    }
  }
  return set;
}

export function hasAllPermissions(rolesFromJwt: string[], required: string[]): boolean {
  if (required.length === 0) {
    return true;
  }
  const roles = rolesFromJwt as unknown as SystemRole[];
  const granted = permissionsForRoles(roles);
  if (granted.has(Permission.WILDCARD)) {
    return true;
  }
  return required.every((p) => granted.has(p));
}
