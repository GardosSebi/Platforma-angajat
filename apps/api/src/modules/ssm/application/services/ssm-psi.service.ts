import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SsmDocumentTargetType, SsmDocumentType, SsmPsiEquipmentStatus } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  CreateSsmPsiEquipmentDto,
  CreateSsmPsiResponsibleDto,
  CreateSsmPsiTrainingRecordDto,
  RegisterSsmPsiEquipmentVerificationDto
} from "../../api/dto/ssm-psi.dto";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

@Injectable()
export class SsmPsiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private async assertWorksite(tenantId: string, worksiteId: string) {
    const worksite = await this.prisma.worksite.findFirst({
      where: { id: worksiteId, tenantId, active: true }
    });
    if (!worksite) throw new NotFoundException("Worksite not found for tenant.");
    return worksite;
  }

  async documentationByWorksite(tenantId: string) {
    const [worksites, documents] = await Promise.all([
      this.prisma.worksite.findMany({
        where: { tenantId, active: true },
        orderBy: { code: "asc" }
      }),
      this.prisma.ssmDocument.findMany({
        where: {
          tenantId,
          type: SsmDocumentType.PSI,
          targetType: { in: [SsmDocumentTargetType.WORKSITE, SsmDocumentTargetType.ALL] }
        },
        include: { activeVersion: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    return {
      worksites: worksites.map((worksite) => ({
        id: worksite.id,
        code: worksite.code,
        name: worksite.name,
        documents: documents
          .filter((document) => document.targetType === SsmDocumentTargetType.ALL || document.targetRefId === worksite.id)
          .map((document) => ({
            id: document.id,
            title: document.title,
            targetType: document.targetType,
            targetLabel: document.targetLabel,
            activeVersionNumber: document.activeVersion?.versionNumber ?? null,
            fileName: document.activeVersion?.fileName ?? null,
            updatedAt: document.updatedAt
          }))
      }))
    };
  }

  async listEquipment(tenantId: string) {
    const rows = await this.prisma.ssmPsiEquipment.findMany({
      where: { tenantId },
      include: { worksite: { select: { code: true, name: true } } },
      orderBy: [{ status: "asc" }, { nextDueAt: "asc" }]
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite.name,
        code: row.code,
        name: row.name,
        category: row.category,
        serialNumber: row.serialNumber,
        location: row.location,
        verificationIntervalDays: row.verificationIntervalDays,
        reminderDays: row.reminderDays,
        lastVerifiedAt: row.lastVerifiedAt,
        nextDueAt: row.nextDueAt,
        status: row.status,
        notes: row.notes
      }))
    };
  }

  async createEquipment(tenantId: string, actorId: string, dto: CreateSsmPsiEquipmentDto) {
    await this.assertWorksite(tenantId, dto.worksiteId);
    const lastVerifiedAt = parseOptionalDate(dto.lastVerifiedAt);
    const nextDueAt = parseOptionalDate(dto.nextDueAt) ?? (lastVerifiedAt ? addDays(lastVerifiedAt, dto.verificationIntervalDays) : undefined);
    const created = await this.prisma.ssmPsiEquipment.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category?.trim(),
        serialNumber: dto.serialNumber?.trim(),
        location: dto.location?.trim(),
        verificationIntervalDays: dto.verificationIntervalDays,
        reminderDays: dto.reminderDays ?? [30, 15, 7],
        lastVerifiedAt,
        nextDueAt,
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_EQUIPMENT_CREATED",
      entityType: "SsmPsiEquipment",
      entityId: created.id,
      payload: { code: created.code, worksiteId: dto.worksiteId }
    });

    return created;
  }

  async registerVerification(tenantId: string, actorId: string, dto: RegisterSsmPsiEquipmentVerificationDto) {
    const equipment = await this.prisma.ssmPsiEquipment.findFirst({
      where: { id: dto.equipmentId, tenantId, status: SsmPsiEquipmentStatus.ACTIVE }
    });
    if (!equipment) throw new NotFoundException("Active PSI equipment not found.");

    const performedAt = parseDate(dto.performedAt);
    const nextDueAt = parseOptionalDate(dto.nextDueAt) ?? addDays(performedAt, equipment.verificationIntervalDays);
    const verification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ssmPsiEquipmentVerification.create({
        data: {
          tenantId,
          equipmentId: equipment.id,
          performedAt,
          nextDueAt,
          result: dto.result.trim(),
          notes: dto.notes?.trim(),
          documentId: dto.documentId?.trim(),
          createdBy: actorId
        }
      });
      await tx.ssmPsiEquipment.update({
        where: { id: equipment.id },
        data: { lastVerifiedAt: performedAt, nextDueAt }
      });
      return created;
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_EQUIPMENT_VERIFIED",
      entityType: "SsmPsiEquipment",
      entityId: equipment.id,
      payload: { verificationId: verification.id, nextDueAt }
    });

    return verification;
  }

  async equipmentNotifications(tenantId: string) {
    const rows = await this.prisma.ssmPsiEquipment.findMany({
      where: { tenantId, status: SsmPsiEquipmentStatus.ACTIVE, nextDueAt: { not: null } },
      include: { worksite: { select: { name: true } } }
    });
    const now = new Date();
    return {
      reminders: rows
        .map((row) => {
          const daysUntilDue = Math.ceil((row.nextDueAt!.getTime() - now.getTime()) / DAY_MS);
          return {
            equipmentId: row.id,
            code: row.code,
            name: row.name,
            worksiteName: row.worksite.name,
            nextDueAt: row.nextDueAt!,
            daysUntilDue
          };
        })
        .filter((item) => {
          const equipment = rows.find((row) => row.id === item.equipmentId);
          return Boolean(equipment?.reminderDays.includes(item.daysUntilDue) || item.daysUntilDue < 0);
        })
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    };
  }

  async listTrainingRecords(tenantId: string) {
    const rows = await this.prisma.ssmPsiTrainingRecord.findMany({
      where: { tenantId },
      include: {
        employee: { select: { fullName: true } },
        worksite: { select: { name: true } }
      },
      orderBy: { conductedAt: "desc" },
      take: 200
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite.name,
        employeeId: row.employeeId,
        employeeName: row.employee?.fullName ?? null,
        trainingTypeId: row.trainingTypeId,
        topic: row.topic,
        conductedAt: row.conductedAt,
        validUntil: row.validUntil,
        trainerName: row.trainerName,
        responsibleName: row.responsibleName,
        evidenceDocumentId: row.evidenceDocumentId,
        notes: row.notes
      }))
    };
  }

  async createTrainingRecord(tenantId: string, actorId: string, dto: CreateSsmPsiTrainingRecordDto) {
    await this.assertWorksite(tenantId, dto.worksiteId);
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, active: true } });
      if (!employee) throw new NotFoundException("Employee not found for tenant.");
    }
    if (dto.trainingTypeId) {
      const trainingType = await this.prisma.ssmTrainingType.findFirst({
        where: { id: dto.trainingTypeId, tenantId, active: true }
      });
      if (!trainingType) throw new NotFoundException("Training type not found for tenant.");
    }

    const created = await this.prisma.ssmPsiTrainingRecord.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        employeeId: dto.employeeId?.trim(),
        trainingTypeId: dto.trainingTypeId?.trim(),
        topic: dto.topic.trim(),
        conductedAt: parseDate(dto.conductedAt),
        validUntil: parseOptionalDate(dto.validUntil),
        trainerName: dto.trainerName.trim(),
        responsibleName: dto.responsibleName?.trim(),
        evidenceDocumentId: dto.evidenceDocumentId?.trim(),
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_TRAINING_RECORDED",
      entityType: "SsmPsiTrainingRecord",
      entityId: created.id
    });

    return created;
  }

  async listResponsibles(tenantId: string) {
    const rows = await this.prisma.ssmPsiResponsible.findMany({
      where: { tenantId },
      include: {
        worksite: { select: { name: true } },
        employee: { select: { fullName: true } }
      },
      orderBy: [{ active: "desc" }, { personName: "asc" }]
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite.name,
        employeeId: row.employeeId,
        employeeName: row.employee?.fullName ?? null,
        role: row.role,
        personName: row.personName,
        email: row.email,
        phone: row.phone,
        active: row.active,
        notes: row.notes
      }))
    };
  }

  async createResponsible(tenantId: string, actorId: string, dto: CreateSsmPsiResponsibleDto) {
    await this.assertWorksite(tenantId, dto.worksiteId);
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, active: true } });
      if (!employee) throw new NotFoundException("Employee not found for tenant.");
    }
    const created = await this.prisma.ssmPsiResponsible.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        employeeId: dto.employeeId?.trim(),
        role: dto.role,
        personName: dto.personName.trim(),
        email: dto.email?.trim(),
        phone: dto.phone?.trim(),
        active: dto.active ?? true,
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_RESPONSIBLE_CREATED",
      entityType: "SsmPsiResponsible",
      entityId: created.id,
      payload: { role: dto.role, worksiteId: dto.worksiteId }
    });

    return created;
  }
}
