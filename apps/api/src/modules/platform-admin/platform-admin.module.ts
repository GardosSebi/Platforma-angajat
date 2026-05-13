import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { AdminUsersController } from "./api/admin-users.controller";
import { AdminScopedRolesController } from "./api/admin-scoped-roles.controller";
import { AdminStaticPagesController } from "./api/admin-static-pages.controller";
import { AdminUsageController } from "./api/admin-usage.controller";
import { EmployeeStaticController } from "./api/employee-static.controller";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminUsersController,
    AdminScopedRolesController,
    AdminStaticPagesController,
    AdminUsageController,
    EmployeeStaticController
  ],
  providers: [PlatformAdminService, PermissionsGuard]
})
export class PlatformAdminModule {}
