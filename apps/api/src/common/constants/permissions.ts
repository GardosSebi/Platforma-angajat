import { SystemRole } from "../prisma-enums";

export const Permission = {
  WILDCARD: "*",
  SSM_TRAINING_ASSIGN: "ssm:training:assign",
  FILES_UPLOAD: "files:upload",
  AUDIT_READ: "audit:read",
  MASTER_DATA_READ: "master-data:read",
  MASTER_DATA_WRITE: "master-data:write",
  MASTER_DATA_IMPORT: "master-data:import"
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

const allPermissions: string[] = [
  Permission.SSM_TRAINING_ASSIGN,
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
    Permission.FILES_UPLOAD,
    Permission.AUDIT_READ,
    ...masterDataReadWrite
  ],
  [SystemRole.SSM_ENTITY_RESPONSIBLE]: [
    Permission.SSM_TRAINING_ASSIGN,
    Permission.FILES_UPLOAD,
    Permission.MASTER_DATA_READ,
    Permission.MASTER_DATA_WRITE,
    Permission.MASTER_DATA_IMPORT
  ],
  [SystemRole.DEPARTMENT_MANAGER]: [Permission.SSM_TRAINING_ASSIGN, Permission.MASTER_DATA_READ],
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
