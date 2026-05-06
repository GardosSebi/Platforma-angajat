import { Inject, Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  AssignTrainingInput,
  SSM_TRAINING_REPOSITORY,
  SsmTrainingRepository
} from "../../domain/repositories/ssm-training.repository";
import { TenantId } from "../../domain/value-objects/tenant-id.vo";

export interface AssignTrainingCommand extends AssignTrainingInput {}

@Injectable()
export class AssignTrainingUseCase {
  constructor(
    @Inject(SSM_TRAINING_REPOSITORY) private readonly repository: SsmTrainingRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(command: AssignTrainingCommand): Promise<{ assignmentId: string }> {
    const tenantId = TenantId.create(command.tenantId);
    const assignment = await this.repository.assignTraining({
      ...command,
      tenantId: tenantId.value
    });

    await this.auditLogService.write({
      tenantId: tenantId.value,
      actorId: command.assignedBy,
      module: "SSM",
      action: "TRAINING_ASSIGNED",
      entityType: "SsmTrainingAssignment",
      entityId: assignment.id,
      payload: {
        employeeId: command.employeeId,
        trainingCode: command.trainingCode
      }
    });

    return { assignmentId: assignment.id };
  }
}
