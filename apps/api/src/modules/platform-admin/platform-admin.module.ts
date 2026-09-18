import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { RetentionModule } from "../../infrastructure/retention/retention.module";
import { MasterDataModule } from "../master-data/master-data.module";
import { AdminUsersController } from "./api/admin-users.controller";
import { AdminScopedRolesController } from "./api/admin-scoped-roles.controller";
import { AdminStaticPagesController } from "./api/admin-static-pages.controller";
import { AdminUsageController } from "./api/admin-usage.controller";
import { AdminGdprController } from "./api/admin-gdpr.controller";
import { AdminSsoController } from "./api/admin-sso.controller";
import { EmployeeStaticController } from "./api/employee-static.controller";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [PrismaModule, MasterDataModule, RetentionModule],
  controllers: [
    AdminUsersController,
    AdminScopedRolesController,
    AdminStaticPagesController,
    AdminUsageController,
    AdminGdprController,
    AdminSsoController,
    EmployeeStaticController
  ],
  providers: [PlatformAdminService, PermissionsGuard]
})
export class PlatformAdminModule {}
