import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import {
  AssignTrainingInput,
  SsmTrainingRepository
} from "../../domain/repositories/ssm-training.repository";

@Injectable()
export class PrismaSsmTrainingRepository implements SsmTrainingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assignTraining(input: AssignTrainingInput): Promise<{ id: string }> {
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
