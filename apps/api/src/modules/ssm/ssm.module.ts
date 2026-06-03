import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { NotificationsModule } from "../../infrastructure/notifications/notifications.module";
import { AssignTrainingUseCase } from "./application/use-cases/assign-training.use-case";
import { SsmDocumentsService } from "./application/services/ssm-documents.service";
import { SsmTrainingSuiteService } from "./application/services/ssm-training-suite.service";
import { SsmEipService } from "./application/services/ssm-eip.service";
import { SsmAccidentsService } from "./application/services/ssm-accidents.service";
import { SsmMedicalService } from "./application/services/ssm-medical.service";
import { SsmRiskService } from "./application/services/ssm-risk.service";
import { SsmPsiService } from "./application/services/ssm-psi.service";
import { SsmOverviewService } from "./application/services/ssm-overview.service";
import { SsmController } from "./api/ssm.controller";
import { SsmDocumentsController } from "./api/ssm-documents.controller";
import { SsmTrainingSuiteController } from "./api/ssm-training-suite.controller";
import { SsmEipController } from "./api/ssm-eip.controller";
import { SsmAccidentsController } from "./api/ssm-accidents.controller";
import { SsmMedicalController } from "./api/ssm-medical.controller";
import { SsmRiskController } from "./api/ssm-risk.controller";
import { SsmPsiController } from "./api/ssm-psi.controller";
import { SsmOverviewController } from "./api/ssm-overview.controller";
import { SSM_TRAINING_REPOSITORY } from "./domain/repositories/ssm-training.repository";
import { PrismaSsmTrainingRepository } from "./infrastructure/prisma/prisma-ssm-training.repository";
import { SapServiceLayerClient } from "./infrastructure/sap/sap-service-layer.client";

@Module({
  imports: [NotificationsModule],
  controllers: [
    SsmController,
    SsmDocumentsController,
    SsmTrainingSuiteController,
    SsmEipController,
    SsmAccidentsController,
    SsmMedicalController,
    SsmRiskController,
    SsmPsiController,
    SsmOverviewController
  ],
  providers: [
    PermissionsGuard,
    AssignTrainingUseCase,
    SsmDocumentsService,
    SsmTrainingSuiteService,
    SsmEipService,
    SsmAccidentsService,
    SsmMedicalService,
    SsmRiskService,
    SsmPsiService,
    SsmOverviewService,
    SapServiceLayerClient,
    {
      provide: SSM_TRAINING_REPOSITORY,
      useClass: PrismaSsmTrainingRepository
    }
  ],
  exports: [SsmTrainingSuiteService, SsmMedicalService]
})
export class SsmModule {}
