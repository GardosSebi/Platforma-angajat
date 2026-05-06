import { Module } from "@nestjs/common";
import { AssignTrainingUseCase } from "./application/use-cases/assign-training.use-case";
import { SsmController } from "./api/ssm.controller";
import { SSM_TRAINING_REPOSITORY } from "./domain/repositories/ssm-training.repository";
import { PrismaSsmTrainingRepository } from "./infrastructure/prisma/prisma-ssm-training.repository";
import { SapServiceLayerClient } from "./infrastructure/sap/sap-service-layer.client";

@Module({
  controllers: [SsmController],
  providers: [
    AssignTrainingUseCase,
    SapServiceLayerClient,
    {
      provide: SSM_TRAINING_REPOSITORY,
      useClass: PrismaSsmTrainingRepository
    }
  ]
})
export class SsmModule {}
