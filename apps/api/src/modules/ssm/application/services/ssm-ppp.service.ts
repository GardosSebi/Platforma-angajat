import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmPreventionMeasureStatus,
  SsmPreventionPlanStatus,
  SsmRiskTargetType
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  CreateSsmEvacuationDrillDto,
  CreateSsmPreventionMeasureDto,
  CreateSsmPreventionPlanDto,
  ListSsmPreventionPlansDto,
  UpdateSsmPreventionMeasureDto
} from "../../api/dto/ssm-ppp.dto";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  return parseDate(value);
}

@Injectable()
export class SsmPppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private async assertTarget(
    tenantId: string,
    targetType: SsmRiskTargetType,
    jobPositionId?: string,
    worksiteId?: string,
    departmentId?: string
  ) {
    if (targetType === SsmRiskTargetType.JOB_POSITION) {
      if (!jobPositionId) throw new BadRequestException("jobPositionId is required.");
      const row = await this.prisma.jobPosition.findFirst({ where: { id: jobPositionId, tenantId } });
      if (!row) throw new BadRequestException("jobPositionId nevalid.");
      return;
    }
    if (targetType === SsmRiskTargetType.WORKSITE) {
      if (!worksiteId) throw new BadRequestException("worksiteId is required.");
      const row = await this.prisma.worksite.findFirst({ where: { id: worksiteId, tenantId } });
      if (!row) throw new BadRequestException("worksiteId nevalid.");
      return;
    }
    if (targetType === SsmRiskTargetType.DEPARTMENT) {
      if (!departmentId) throw new BadRequestException("departmentId is required.");
      const row = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!row) throw new BadRequestException("departmentId nevalid.");
    }
  }

  async listPlans(tenantId: string, query?: ListSsmPreventionPlansDto) {
    const rows = await this.prisma.ssmPreventionPlan.findMany({
      where: {
        tenantId,
        ...(query?.targetType ? { targetType: query.targetType } : {}),
        ...(query?.status ? { status: query.status } : {})
      },
      include: {
        jobPosition: { select: { code: true, name: true } },
        worksite: { select: { code: true, name: true } },
        department: { select: { code: true, name: true } },
        measures: {
          orderBy: [{ status: "asc" }, { dueDate: "asc" }]
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        targetType: row.targetType,
        jobPositionId: row.jobPositionId,
        worksiteId: row.worksiteId,
        departmentId: row.departmentId,
        jobPositionName: row.jobPosition?.name ?? null,
        worksiteName: row.worksite?.name ?? null,
        departmentName: row.department?.name ?? null,
        status: row.status,
        reviewDate: row.reviewDate?.toISOString() ?? null,
        notes: row.notes,
        measureCount: row.measures.length,
        openMeasures: row.measures.filter((m) => m.status !== SsmPreventionMeasureStatus.COMPLETED).length,
        measures: row.measures.map((m) => this.mapMeasure(m)),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      }))
    };
  }

  private mapMeasure(m: {
    id: string;
    planId: string;
    description: string;
    responsiblePerson: string | null;
    dueDate: Date | null;
    status: SsmPreventionMeasureStatus;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: m.id,
      planId: m.planId,
      description: m.description,
      responsiblePerson: m.responsiblePerson,
      dueDate: m.dueDate?.toISOString() ?? null,
      status: m.status,
      completedAt: m.completedAt?.toISOString() ?? null,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString()
    };
  }

  async createPlan(tenantId: string, actorId: string, dto: CreateSsmPreventionPlanDto) {
    await this.assertTarget(tenantId, dto.targetType, dto.jobPositionId, dto.worksiteId, dto.departmentId);
    const plan = await this.prisma.ssmPreventionPlan.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        targetType: dto.targetType,
        jobPositionId: dto.jobPositionId,
        worksiteId: dto.worksiteId,
        departmentId: dto.departmentId,
        reviewDate: parseOptionalDate(dto.reviewDate),
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_PLAN_CREATED",
      entityType: "SsmPreventionPlan",
      entityId: plan.id
    });
    return { planId: plan.id };
  }

  async archivePlan(tenantId: string, actorId: string, planId: string) {
    const existing = await this.prisma.ssmPreventionPlan.findFirst({ where: { id: planId, tenantId } });
    if (!existing) throw new NotFoundException("Plan PPP negăsit.");
    await this.prisma.ssmPreventionPlan.update({
      where: { id: planId },
      data: { status: SsmPreventionPlanStatus.ARCHIVED }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_PLAN_ARCHIVED",
      entityType: "SsmPreventionPlan",
      entityId: planId
    });
    return { archived: true };
  }

  async createMeasure(tenantId: string, actorId: string, dto: CreateSsmPreventionMeasureDto) {
    const plan = await this.prisma.ssmPreventionPlan.findFirst({
      where: { id: dto.planId, tenantId, status: SsmPreventionPlanStatus.ACTIVE }
    });
    if (!plan) throw new NotFoundException("Plan PPP activ negăsit.");
    const measure = await this.prisma.ssmPreventionMeasure.create({
      data: {
        tenantId,
        planId: dto.planId,
        description: dto.description.trim(),
        responsiblePerson: dto.responsiblePerson?.trim(),
        dueDate: parseOptionalDate(dto.dueDate),
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });
    await this.syncMeasureOverdue(tenantId);
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_MEASURE_CREATED",
      entityType: "SsmPreventionMeasure",
      entityId: measure.id
    });
    return { measureId: measure.id };
  }

  async updateMeasure(tenantId: string, actorId: string, measureId: string, dto: UpdateSsmPreventionMeasureDto) {
    const existing = await this.prisma.ssmPreventionMeasure.findFirst({ where: { id: measureId, tenantId } });
    if (!existing) throw new NotFoundException("Măsură PPP negăsită.");
    const status = dto.status ?? existing.status;
    const completedAt =
      status === SsmPreventionMeasureStatus.COMPLETED
        ? existing.completedAt ?? new Date()
        : status === SsmPreventionMeasureStatus.OPEN
          ? null
          : existing.completedAt;
    const updated = await this.prisma.ssmPreventionMeasure.update({
      where: { id: measureId },
      data: {
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.responsiblePerson !== undefined ? { responsiblePerson: dto.responsiblePerson?.trim() || null } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: parseOptionalDate(dto.dueDate) ?? null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        status,
        completedAt
      }
    });
    await this.syncMeasureOverdue(tenantId);
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_MEASURE_UPDATED",
      entityType: "SsmPreventionMeasure",
      entityId: measureId,
      payload: { status: updated.status }
    });
    return this.mapMeasure(updated);
  }

  private async syncMeasureOverdue(tenantId: string) {
    const now = new Date();
    await this.prisma.ssmPreventionMeasure.updateMany({
      where: {
        tenantId,
        status: SsmPreventionMeasureStatus.OPEN,
        dueDate: { lt: now }
      },
      data: { status: SsmPreventionMeasureStatus.OVERDUE }
    });
  }

  async listEvacuationDrills(tenantId: string) {
    const rows = await this.prisma.ssmEvacuationDrill.findMany({
      where: { tenantId },
      include: { worksite: { select: { code: true, name: true } } },
      orderBy: { conductedAt: "desc" }
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite.name,
        conductedAt: row.conductedAt.toISOString(),
        nextDueAt: row.nextDueAt?.toISOString() ?? null,
        durationMinutes: row.durationMinutes,
        participantsCount: row.participantsCount,
        result: row.result,
        coordinatorName: row.coordinatorName,
        notes: row.notes,
        createdAt: row.createdAt.toISOString()
      }))
    };
  }

  async createEvacuationDrill(tenantId: string, actorId: string, dto: CreateSsmEvacuationDrillDto) {
    const worksite = await this.prisma.worksite.findFirst({ where: { id: dto.worksiteId, tenantId } });
    if (!worksite) throw new NotFoundException("Punct de lucru negăsit.");
    const drill = await this.prisma.ssmEvacuationDrill.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        conductedAt: parseDate(dto.conductedAt),
        nextDueAt: parseOptionalDate(dto.nextDueAt),
        durationMinutes: dto.durationMinutes,
        participantsCount: dto.participantsCount,
        result: dto.result.trim(),
        coordinatorName: dto.coordinatorName?.trim(),
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EVACUATION_DRILL_RECORDED",
      entityType: "SsmEvacuationDrill",
      entityId: drill.id
    });
    return { drillId: drill.id };
  }
}
