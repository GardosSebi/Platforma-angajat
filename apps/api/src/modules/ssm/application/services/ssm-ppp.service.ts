import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SsmPreventionMeasureStatus,
  SsmPreventionPlanStatus,
  SsmRiskTargetType
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  AddSsmPreventionPlanVersionDto,
  CreateSsmEvacuationDrillDto,
  CreateSsmPreventionMeasureDto,
  CreateSsmPreventionPlanDto,
  ListSsmPreventionPlansDto,
  UpdateSsmPreventionMeasureDto
} from "../../api/dto/ssm-ppp.dto";

type MeasureSnapshot = {
  description: string;
  responsiblePerson?: string | null;
  dueDate?: string | null;
  status?: SsmPreventionMeasureStatus | string;
  notes?: string | null;
};

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

function parseOptionalDate(value?: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  return parseDate(value);
}

function asMeasureSnapshots(value: unknown): MeasureSnapshot[] {
  if (!Array.isArray(value)) return [];
  const result: MeasureSnapshot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const description = typeof row.description === "string" ? row.description.trim() : "";
    if (!description) continue;
    result.push({
      description,
      responsiblePerson:
        typeof row.responsiblePerson === "string" ? row.responsiblePerson.trim() || null : null,
      dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
      status: typeof row.status === "string" ? row.status : SsmPreventionMeasureStatus.OPEN,
      notes: typeof row.notes === "string" ? row.notes.trim() || null : null
    });
  }
  return result;
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

  private snapshotFromLiveMeasures(
    measures: Array<{
      description: string;
      responsiblePerson: string | null;
      dueDate: Date | null;
      status: SsmPreventionMeasureStatus;
      notes: string | null;
    }>
  ): MeasureSnapshot[] {
    return measures.map((m) => ({
      description: m.description,
      responsiblePerson: m.responsiblePerson,
      dueDate: m.dueDate?.toISOString() ?? null,
      status: m.status,
      notes: m.notes
    }));
  }

  private async syncActiveVersionSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    planId: string,
    actorId: string
  ) {
    const plan = await tx.ssmPreventionPlan.findFirst({
      where: { id: planId, tenantId },
      include: { measures: { orderBy: { createdAt: "asc" } }, activeVersion: true }
    });
    if (!plan?.activeVersionId) return;

    const snapshot = this.snapshotFromLiveMeasures(plan.measures);
    await tx.ssmPreventionPlanVersion.update({
      where: { id: plan.activeVersionId },
      data: {
        measures: snapshot as unknown as Prisma.InputJsonValue,
        reviewDate: plan.reviewDate,
        notes: plan.notes,
        ...(plan.activeVersion?.updateReason ? {} : { updateReason: "Actualizare măsuri" }),
        createdBy: plan.activeVersion?.createdBy ?? actorId
      }
    });
  }

  private async replaceLiveMeasures(
    tx: Prisma.TransactionClient,
    tenantId: string,
    planId: string,
    actorId: string,
    measures: MeasureSnapshot[]
  ) {
    await tx.ssmPreventionMeasure.deleteMany({ where: { tenantId, planId } });
    if (!measures.length) return;
    await tx.ssmPreventionMeasure.createMany({
      data: measures.map((measure) => {
        const status =
          measure.status === SsmPreventionMeasureStatus.COMPLETED ||
          measure.status === SsmPreventionMeasureStatus.OVERDUE ||
          measure.status === SsmPreventionMeasureStatus.OPEN
            ? measure.status
            : SsmPreventionMeasureStatus.OPEN;
        return {
          tenantId,
          planId,
          description: measure.description.trim(),
          responsiblePerson: measure.responsiblePerson?.trim() || undefined,
          dueDate: parseOptionalDate(measure.dueDate ?? undefined),
          status,
          completedAt: status === SsmPreventionMeasureStatus.COMPLETED ? new Date() : undefined,
          notes: measure.notes?.trim() || undefined,
          createdBy: actorId
        };
      })
    });
  }

  async listPlans(tenantId: string, query?: ListSsmPreventionPlansDto) {
    const rows = await this.prisma.ssmPreventionPlan.findMany({
      where: {
        tenantId,
        ...(query?.targetType ? { targetType: query.targetType } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.riskAssessmentId ? { riskAssessmentId: query.riskAssessmentId } : {})
      },
      include: {
        jobPosition: { select: { code: true, name: true } },
        worksite: { select: { code: true, name: true } },
        department: { select: { code: true, name: true } },
        riskAssessment: { select: { id: true, title: true } },
        activeVersion: true,
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
        riskAssessmentId: row.riskAssessmentId,
        riskAssessmentTitle: row.riskAssessment?.title ?? null,
        status: row.status,
        activeVersionId: row.activeVersionId,
        activeVersionNumber: row.activeVersion?.versionNumber ?? null,
        updateReason: row.activeVersion?.updateReason ?? null,
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

  async createPlan(tenantId: string, actorId: string, dto: CreateSsmPreventionPlanDto) {
    await this.assertTarget(tenantId, dto.targetType, dto.jobPositionId, dto.worksiteId, dto.departmentId);
    if (dto.riskAssessmentId) {
      const assessment = await this.prisma.ssmRiskAssessment.findFirst({
        where: { id: dto.riskAssessmentId, tenantId }
      });
      if (!assessment) throw new BadRequestException("riskAssessmentId nevalid.");
    }

    const planId = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.ssmPreventionPlan.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          targetType: dto.targetType,
          jobPositionId: dto.jobPositionId,
          worksiteId: dto.worksiteId,
          departmentId: dto.departmentId,
          riskAssessmentId: dto.riskAssessmentId,
          reviewDate: parseOptionalDate(dto.reviewDate),
          notes: dto.notes?.trim(),
          createdBy: actorId
        }
      });
      const version = await tx.ssmPreventionPlanVersion.create({
        data: {
          tenantId,
          planId: plan.id,
          versionNumber: 1,
          updateReason: "Versiune inițială",
          reviewDate: parseOptionalDate(dto.reviewDate),
          notes: dto.notes?.trim(),
          measures: [] as unknown as Prisma.InputJsonValue,
          createdBy: actorId
        }
      });
      await tx.ssmPreventionPlan.update({
        where: { id: plan.id },
        data: { activeVersionId: version.id }
      });
      return plan.id;
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_PLAN_CREATED",
      entityType: "SsmPreventionPlan",
      entityId: planId,
      payload: { riskAssessmentId: dto.riskAssessmentId ?? null, version: 1 }
    });
    return { planId };
  }

  async addVersion(tenantId: string, actorId: string, planId: string, dto: AddSsmPreventionPlanVersionDto) {
    const plan = await this.prisma.ssmPreventionPlan.findFirst({
      where: { id: planId, tenantId }
    });
    if (!plan) throw new NotFoundException("Plan PPP negăsit.");
    if (plan.status === SsmPreventionPlanStatus.ARCHIVED) {
      throw new BadRequestException("Cannot version an archived PPP plan.");
    }

    const measures = (dto.measures ?? [])
      .map((m) => ({
        description: m.description.trim(),
        responsiblePerson: m.responsiblePerson?.trim() || null,
        dueDate: m.dueDate ?? null,
        status: m.status ?? SsmPreventionMeasureStatus.OPEN,
        notes: m.notes?.trim() || null
      }))
      .filter((m) => m.description.length > 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const lastVersion = await tx.ssmPreventionPlanVersion.findFirst({
        where: { tenantId, planId },
        orderBy: { versionNumber: "desc" }
      });
      const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;
      const reviewDate = parseOptionalDate(dto.reviewDate) ?? plan.reviewDate ?? undefined;
      const notes = dto.notes?.trim() ?? plan.notes ?? undefined;

      const version = await tx.ssmPreventionPlanVersion.create({
        data: {
          tenantId,
          planId,
          versionNumber: nextVersion,
          updateReason: dto.updateReason.trim(),
          reviewDate,
          notes,
          measures: measures as unknown as Prisma.InputJsonValue,
          createdBy: actorId
        }
      });

      await tx.ssmPreventionPlan.update({
        where: { id: planId },
        data: {
          activeVersionId: version.id,
          reviewDate: reviewDate ?? null,
          notes: notes ?? null
        }
      });

      await this.replaceLiveMeasures(tx, tenantId, planId, actorId, measures);
      return { versionId: version.id, versionNumber: nextVersion };
    });

    await this.syncMeasureOverdue(tenantId);
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PPP_PLAN_VERSION_ADDED",
      entityType: "SsmPreventionPlan",
      entityId: planId,
      payload: { version: result.versionNumber, measureCount: measures.length, reason: dto.updateReason.trim() }
    });

    return { planId, versionId: result.versionId, versionNumber: result.versionNumber };
  }

  async history(tenantId: string, planId: string) {
    const plan = await this.prisma.ssmPreventionPlan.findFirst({
      where: { id: planId, tenantId },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        activeVersion: true
      }
    });
    if (!plan) throw new NotFoundException("Plan PPP negăsit.");
    return {
      planId: plan.id,
      title: plan.title,
      activeVersionId: plan.activeVersionId,
      versions: plan.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        updateReason: version.updateReason,
        reviewDate: version.reviewDate?.toISOString() ?? null,
        notes: version.notes,
        measures: asMeasureSnapshots(version.measures),
        createdBy: version.createdBy,
        createdAt: version.createdAt.toISOString()
      }))
    };
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
    const measure = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ssmPreventionMeasure.create({
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
      await this.syncActiveVersionSnapshot(tx, tenantId, dto.planId, actorId);
      return created;
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
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ssmPreventionMeasure.update({
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
      await this.syncActiveVersionSnapshot(tx, tenantId, existing.planId, actorId);
      return row;
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
