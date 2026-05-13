/**
 * Mirrors enums in prisma/schema.prisma — keep in sync when the schema changes.
 * Used so app code does not depend on @prisma/client enum exports before `prisma generate`.
 */
export enum SystemRole {
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  TENANT_ADMIN = "TENANT_ADMIN",
  SSM_ADMIN = "SSM_ADMIN",
  SSM_ENTITY_RESPONSIBLE = "SSM_ENTITY_RESPONSIBLE",
  DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER",
  EMPLOYEE = "EMPLOYEE"
}

export enum SsmResponsibleType {
  DESIGNATED_WORKER = "DESIGNATED_WORKER",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE"
}

export enum RoleAssignmentScope {
  WORKSITE = "WORKSITE",
  EMPLOYEE_GROUP = "EMPLOYEE_GROUP"
}

export enum EmployeeStaticAudienceType {
  ALL = "ALL",
  WORKSITE = "WORKSITE",
  EMPLOYEE_GROUP = "EMPLOYEE_GROUP"
}
