import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { AssignTrainingUseCase } from "../application/use-cases/assign-training.use-case";
import { AssignTrainingDto } from "./dto/assign-training.dto";

@Controller("ssm/trainings")
@UseGuards(JwtAuthGuard, TenantGuard)
export class SsmController {
  constructor(private readonly assignTrainingUseCase: AssignTrainingUseCase) {}

  @Get("health")
  health() {
    return { module: "ssm", status: "ok" };
  }

  @Post("assign")
  async assignTraining(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: AssignTrainingDto
  ) {
    return this.assignTrainingUseCase.execute({
      tenantId,
      employeeId: dto.employeeId,
      trainingCode: dto.trainingCode,
      dueDate: new Date(dto.dueDate),
      assignedBy: user.sub
    });
  }
}
