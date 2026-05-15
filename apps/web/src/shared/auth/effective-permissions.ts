/** Mirrors API `ROLE_PERMISSIONS` / `Permission` for SSM UI. Update when backend matrix changes. */

const WILDCARD = "*";

const Permission = {
  WILDCARD,
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
  SURVEYS_VIEW: "surveys:view",
  SURVEYS_EDIT: "surveys:edit",
  SURVEYS_RESPOND: "surveys:respond",
  SURVEYS_EXPORT: "surveys:export",
  FILES_UPLOAD: "files:upload",
  AUDIT_READ: "audit:read",
  MASTER_DATA_READ: "master-data:read"
} as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SSM_ADMIN: [
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
    Permission.FILES_UPLOAD,
    Permission.AUDIT_READ,
    Permission.MASTER_DATA_READ,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_EDIT,
    Permission.SURVEYS_RESPOND,
    Permission.SURVEYS_EXPORT
  ],
  SSM_ENTITY_RESPONSIBLE: [
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
    Permission.FILES_UPLOAD,
    Permission.MASTER_DATA_READ,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_EDIT,
    Permission.SURVEYS_RESPOND,
    Permission.SURVEYS_EXPORT
  ],
  DEPARTMENT_MANAGER: [
    Permission.SSM_DOCUMENT_VIEW,
    Permission.SSM_TRAINING_VIEW,
    Permission.SSM_TRAINING_APPROVE,
    Permission.SSM_EIP_VIEW,
    Permission.SSM_ACCIDENT_VIEW,
    Permission.SSM_MEDICAL_VIEW,
    Permission.SSM_RISK_VIEW,
    Permission.SSM_PSI_VIEW,
    Permission.SSM_DASHBOARD_VIEW,
    Permission.SSM_REPORT_VIEW,
    Permission.MASTER_DATA_READ,
    Permission.SURVEYS_VIEW,
    Permission.SURVEYS_RESPOND,
    Permission.SURVEYS_EXPORT
  ],
  EMPLOYEE: [Permission.SURVEYS_RESPOND, Permission.SSM_DOCUMENT_VIEW, Permission.SSM_TRAINING_VIEW, Permission.SSM_TRAINING_EDIT]
};

function permissionsForRoles(roles: string[]): Set<string> {
  const set = new Set<string>();
  for (const role of roles) {
    const list = ROLE_PERMISSIONS[role];
    if (!list) continue;
    for (const p of list) set.add(p);
  }
  return set;
}

export function hasPermission(roles: string[] | undefined, permission: string): boolean {
  if (!roles?.length) return false;
  const granted = permissionsForRoles(roles);
  if (granted.has(Permission.WILDCARD)) return true;
  return granted.has(permission);
}

export const SsmSectionPermission = {
  quick: Permission.SSM_TRAINING_ASSIGN,
  documents: Permission.SSM_DOCUMENT_VIEW,
  training: Permission.SSM_TRAINING_VIEW,
  eip: Permission.SSM_EIP_VIEW,
  accidents: Permission.SSM_ACCIDENT_VIEW,
  medical: Permission.SSM_MEDICAL_VIEW,
  risk: Permission.SSM_RISK_VIEW,
  psi: Permission.SSM_PSI_VIEW,
  compliance: Permission.SSM_DASHBOARD_VIEW,
  reports: Permission.SSM_REPORT_VIEW
} as const;

export type SsmSectionId = keyof typeof SsmSectionPermission;

export function canAccessSsmSection(roles: string[] | undefined, section: SsmSectionId): boolean {
  return hasPermission(roles, SsmSectionPermission[section]);
}
