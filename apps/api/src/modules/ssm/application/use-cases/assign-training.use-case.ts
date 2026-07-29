import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { SsmTrainingSuiteService } from "../services/ssm-training-suite.service";
import { AssignTrainingInput } from "../../domain/repositories/ssm-training.repository";
import { TenantId } from "../../domain/value-objects/tenant-id.vo";

export interface AssignTrainingCommand extends AssignTrainingInput {}

/**
 * Legacy endpoint `/ssm/trainings/assign` — redirects to the training-suite plan flow.
 * Keeps API compatibility while stopping writes to SsmTrainingAssignment.
 */
@Injectable()
export class AssignTrainingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingSuite: SsmTrainingSuiteService,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(command: AssignTrainingCommand): Promise<{ assignmentId: string; planId: string }> {
    const tenantId = TenantId.create(command.tenantId).value;
    const code = command.trainingCode.trim().toUpperCase();
    const type = await this.prisma.ssmTrainingType.findFirst({
      where: { tenantId, code, active: true }
    });
    if (!type) {
      throw new NotFoundException(
        `Tipul de instruire cu codul ${code} nu există în catalogul training-suite. Creați tipul înainte de alocare.`
      );
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: command.employeeId, tenantId, active: true }
    });
    if (!employee) {
      throw new BadRequestException("Employee not found for tenant.");
    }

    const now = new Date();
    const dueAt = command.dueDate instanceof Date ? command.dueDate : new Date(command.dueDate);
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException("Invalid dueDate.");
    }

    const plan = await this.trainingSuite.createTrainingPlan(tenantId, command.assignedBy, {
      employeeId: command.employeeId,
      trainingTypeId: type.id,
      scheduledAt: now.toISOString(),
      dueAt: dueAt.toISOString(),
      materialTitle: `Alocare legacy → suite (${code})`
    });

    await this.auditLogService.write({
      tenantId,
      actorId: command.assignedBy,
      module: "SSM",
      action: "TRAINING_ASSIGNED",
      entityType: "SsmTrainingPlan",
      entityId: plan.id,
      payload: {
        employeeId: command.employeeId,
        trainingCode: code,
        legacyEndpoint: true
      }
    });

    return { assignmentId: plan.id, planId: plan.id };
  }
}
