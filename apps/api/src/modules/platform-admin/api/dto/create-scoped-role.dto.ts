import { IsIn, IsNotEmpty, IsString, ValidateIf } from "class-validator";
import { RoleAssignmentScope, SystemRole } from "../../../../common/prisma-enums";

const SCOPES = Object.values(RoleAssignmentScope);
const ROLES = Object.values(SystemRole);

export class CreateScopedRoleDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn(ROLES)
  role!: SystemRole;

  @IsIn(SCOPES)
  scope!: RoleAssignmentScope;

  @ValidateIf((o: CreateScopedRoleDto) => o.scope === RoleAssignmentScope.WORKSITE)
  @IsString()
  @IsNotEmpty()
  worksiteId?: string;

  @ValidateIf((o: CreateScopedRoleDto) => o.scope === RoleAssignmentScope.EMPLOYEE_GROUP)
  @IsString()
  @IsNotEmpty()
  employeeGroupId?: string;
}
