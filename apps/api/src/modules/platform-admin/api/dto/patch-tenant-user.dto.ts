import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional } from "class-validator";
import { SystemRole } from "../../../../common/prisma-enums";

const ROLES = Object.values(SystemRole);

export class PatchTenantUserDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ROLES, { each: true })
  roles?: SystemRole[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
