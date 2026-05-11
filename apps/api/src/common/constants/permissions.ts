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
  FILES_UPLOAD: "files:upload",
  AUDIT_READ: "audit:read",
  MASTER_DATA_READ: "master-data:read",
  MASTER_DATA_WRITE: "master-data:write",
  MASTER_DATA_IMPORT: "master-data:import"
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
  Permission.FILES_UPLOAD,
  Permission.AUDIT_READ,
  Permission.MASTER_DATA_READ,
  Permission.MASTER_DATA_WRITE,
  Permission.MASTER_DATA_IMPORT
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
    Permission.MASTER_DATA_READ
  ],
  [SystemRole.EMPLOYEE]: []
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
