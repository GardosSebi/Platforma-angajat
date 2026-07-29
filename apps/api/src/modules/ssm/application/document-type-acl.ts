import { ForbiddenException } from "@nestjs/common";
import { SsmDocumentType } from "@prisma/client";
import { hasAllPermissions, Permission } from "../../../common/constants/permissions";
import { SystemRole } from "../../../common/prisma-enums";
import { JwtPayload } from "../../../auth/jwt.strategy";

export type DocumentAclAction = "view" | "edit" | "approve";

export type DocumentTypePolicyRow = {
  documentType: SsmDocumentType;
  viewRoles: string[];
  editRoles: string[];
  approveRoles: string[];
  relatedModuleHint: string | null;
};

/** Default related structured modules for dual-path clarification. */
export const DOCUMENT_TYPE_MODULE_HINTS: Partial<Record<SsmDocumentType, string>> = {
  RISK_ASSESSMENT: "risk",
  EXPOSURE_SHEET: "risk",
  PPP: "ppp",
  PSI: "psi",
  EMERGENCY_PROCEDURE: "psi",
  REGISTER: "accidents",
  THEMATIC: "training"
};

const DEFAULT_ROLE_SETS: Partial<
  Record<SsmDocumentType, { view: SystemRole[]; edit: SystemRole[]; approve: SystemRole[] }>
> = {
  RISK_ASSESSMENT: {
    view: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE, SystemRole.DEPARTMENT_MANAGER],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  },
  EXPOSURE_SHEET: {
    view: [
      SystemRole.SSM_ADMIN,
      SystemRole.SSM_ENTITY_RESPONSIBLE,
      SystemRole.DEPARTMENT_MANAGER,
      SystemRole.EMPLOYEE
    ],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  },
  PPP: {
    view: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE, SystemRole.DEPARTMENT_MANAGER],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  },
  PSI: {
    view: [
      SystemRole.SSM_ADMIN,
      SystemRole.SSM_ENTITY_RESPONSIBLE,
      SystemRole.DEPARTMENT_MANAGER,
      SystemRole.EMPLOYEE
    ],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE, SystemRole.DEPARTMENT_MANAGER],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  },
  EMERGENCY_PROCEDURE: {
    view: [
      SystemRole.SSM_ADMIN,
      SystemRole.SSM_ENTITY_RESPONSIBLE,
      SystemRole.DEPARTMENT_MANAGER,
      SystemRole.EMPLOYEE
    ],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  },
  REGISTER: {
    view: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE, SystemRole.ITM_INSPECTOR],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN]
  },
  THEMATIC: {
    view: [
      SystemRole.SSM_ADMIN,
      SystemRole.SSM_ENTITY_RESPONSIBLE,
      SystemRole.DEPARTMENT_MANAGER,
      SystemRole.EMPLOYEE
    ],
    edit: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE],
    approve: [SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE]
  }
};

function basePermissionForAction(action: DocumentAclAction): string {
  if (action === "view") return Permission.SSM_DOCUMENT_VIEW;
  if (action === "edit") return Permission.SSM_DOCUMENT_EDIT;
  return Permission.SSM_DOCUMENT_APPROVE;
}

function roleListForAction(policy: DocumentTypePolicyRow | undefined, action: DocumentAclAction): string[] {
  if (!policy) return [];
  if (action === "view") return policy.viewRoles;
  if (action === "edit") return policy.editRoles;
  return policy.approveRoles;
}

export function canAccessDocumentType(
  viewer: JwtPayload,
  documentType: SsmDocumentType,
  action: DocumentAclAction,
  policies: DocumentTypePolicyRow[]
): boolean {
  const roles = viewer.roles ?? [];
  if (roles.includes(SystemRole.SSM_ADMIN)) {
    return true;
  }
  if (!hasAllPermissions(roles, [basePermissionForAction(action)])) {
    return false;
  }
  const policy = policies.find((p) => p.documentType === documentType);
  const allowedRoles = roleListForAction(policy, action);
  if (!allowedRoles.length) {
    return true;
  }
  return roles.some((role) => allowedRoles.includes(role));
}

export function assertDocumentTypeAccess(
  viewer: JwtPayload,
  documentType: SsmDocumentType,
  action: DocumentAclAction,
  policies: DocumentTypePolicyRow[]
): void {
  if (!canAccessDocumentType(viewer, documentType, action, policies)) {
    throw new ForbiddenException(
      `Nu aveți drepturi de ${action} pentru categoria de document ${documentType}.`
    );
  }
}

export function defaultPoliciesForSeed(tenantId: string): Array<{
  tenantId: string;
  documentType: SsmDocumentType;
  viewRoles: string[];
  editRoles: string[];
  approveRoles: string[];
  relatedModuleHint: string | null;
}> {
  return Object.values(SsmDocumentType).map((documentType) => {
    const defaults = DEFAULT_ROLE_SETS[documentType];
    return {
      tenantId,
      documentType,
      viewRoles: defaults?.view ?? [],
      editRoles: defaults?.edit ?? [],
      approveRoles: defaults?.approve ?? [],
      relatedModuleHint: DOCUMENT_TYPE_MODULE_HINTS[documentType] ?? null
    };
  });
}
