import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import {
  AssignTrainingInput,
  SsmTrainingRepository
} from "../../domain/repositories/ssm-training.repository";

@Injectable()
export class PrismaSsmTrainingRepository implements SsmTrainingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assignTraining(input: AssignTrainingInput): Promise<{ id: string }> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, tenantId: input.tenantId, active: true },
      select: { id: true }
    });
    if (!employee) {
      throw new NotFoundException("Angajatul nu a fost găsit pentru acest tenant. Verifică identificatorul și autentifică-te pe același tenant.");
    }

    const created = await this.prisma.ssmTrainingAssignment.create({
      data: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        trainingCode: input.trainingCode,
        dueDate: input.dueDate,
        assignedBy: input.assignedBy
      },
      select: {
        id: true
      }
    });

    return created;
  }
}
