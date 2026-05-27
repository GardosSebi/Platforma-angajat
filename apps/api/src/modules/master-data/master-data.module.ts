import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { MasterDataService } from "./master-data.service";
import { WorksitesController } from "./api/worksites.controller";
import { DepartmentsController } from "./api/departments.controller";
import { JobPositionsController } from "./api/job-positions.controller";
import { EmployeesController } from "./api/employees.controller";
import { GroupsController } from "./api/groups.controller";
import { SsmResponsiblesController } from "./api/ssm-responsibles.controller";
import { MasterDataImportController } from "./api/import.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [
    WorksitesController,
    DepartmentsController,
    JobPositionsController,
    EmployeesController,
    GroupsController,
    SsmResponsiblesController,
    MasterDataImportController
  ],
  providers: [MasterDataService, PermissionsGuard],
  exports: [MasterDataService]
})
export class MasterDataModule {}
