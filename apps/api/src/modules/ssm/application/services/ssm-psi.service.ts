import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmDocumentTargetType,
  SsmDocumentType,
  SsmPsiEquipmentCategory,
  SsmPsiEquipmentStatus,
  SsmTrainingCategory
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import {
  CreateSsmPsiEquipmentDto,
  CreateSsmPsiResponsibleDto,
  CreateSsmPsiTrainingRecordDto,
  RegisterSsmPsiEquipmentVerificationDto,
  UpdateSsmPsiEquipmentDto
} from "../../api/dto/ssm-psi.dto";

const DAY_MS = 24 * 60 * 60 * 1000;

type PsiDocKind = "INSTRUCTIONS" | "EVACUATION_PLAN" | "INTERVENTION" | "OTHER";

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

function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function classifyPsiDocument(type: SsmDocumentType, title: string): PsiDocKind {
  const normalized = title.toLowerCase();
  if (/evacuare|evacuat|evacuation|plan\s+de\s+evacu/.test(normalized)) return "EVACUATION_PLAN";
  if (/interven|organizare|coordonare\s+urgen|emergency\s+organiz/.test(normalized)) return "INTERVENTION";
  if (/instruc|ipssm|psi\s+instr/.test(normalized)) return "INSTRUCTIONS";
  if (type === SsmDocumentType.EMERGENCY_PROCEDURE) return "INTERVENTION";
  if (type === SsmDocumentType.PSI) return "OTHER";
  return "OTHER";
}

function mapEquipment(row: {
  id: string;
  worksiteId: string;
  worksite: { name: string };
  code: string;
  name: string;
  category: SsmPsiEquipmentCategory;
  serialNumber: string | null;
  location: string | null;
  verificationIntervalDays: number;
  reminderDays: number[];
  lastVerifiedAt: Date | null;
  nextDueAt: Date | null;
  status: SsmPsiEquipmentStatus;
  notes: string | null;
}) {
  return {
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
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    nextDueAt: row.nextDueAt?.toISOString() ?? null,
    status: row.status,
    notes: row.notes
  };
}

@Injectable()
export class SsmPsiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
    private readonly notifications: NotificationsService
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
          type: { in: [SsmDocumentType.PSI, SsmDocumentType.EMERGENCY_PROCEDURE] },
          targetType: { in: [SsmDocumentTargetType.WORKSITE, SsmDocumentTargetType.ALL] }
        },
        include: { activeVersion: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    return {
      worksites: worksites.map((worksite) => {
        const worksiteDocs = documents
          .filter((document) => document.targetType === SsmDocumentTargetType.ALL || document.targetRefId === worksite.id)
          .map((document) => {
            const kind = classifyPsiDocument(document.type, document.title);
            return {
              id: document.id,
              title: document.title,
              type: document.type,
              kind,
              targetType: document.targetType,
              targetLabel: document.targetLabel,
              activeVersionNumber: document.activeVersion?.versionNumber ?? null,
              fileName: document.activeVersion?.fileName ?? null,
              updatedAt: document.updatedAt.toISOString()
            };
          });
        return {
          id: worksite.id,
          code: worksite.code,
          name: worksite.name,
          documents: worksiteDocs,
          coverage: {
            instructions: worksiteDocs.some((doc) => doc.kind === "INSTRUCTIONS"),
            evacuationPlan: worksiteDocs.some((doc) => doc.kind === "EVACUATION_PLAN"),
            intervention: worksiteDocs.some((doc) => doc.kind === "INTERVENTION")
          }
        };
      })
    };
  }

  async listEquipment(tenantId: string) {
    const rows = await this.prisma.ssmPsiEquipment.findMany({
      where: { tenantId },
      include: { worksite: { select: { code: true, name: true } } },
      orderBy: [{ status: "asc" }, { nextDueAt: "asc" }]
    });
    return { items: rows.map(mapEquipment) };
  }

  async createEquipment(tenantId: string, actorId: string, dto: CreateSsmPsiEquipmentDto) {
    await this.assertWorksite(tenantId, dto.worksiteId);
    const lastVerifiedAt = parseOptionalDate(dto.lastVerifiedAt);
    const nextDueAt =
      parseOptionalDate(dto.nextDueAt) ?? (lastVerifiedAt ? addDays(lastVerifiedAt, dto.verificationIntervalDays) : undefined);
    const created = await this.prisma.ssmPsiEquipment.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        serialNumber: dto.serialNumber?.trim(),
        location: dto.location?.trim(),
        verificationIntervalDays: dto.verificationIntervalDays,
        reminderDays: dto.reminderDays ?? [30, 15, 7],
        lastVerifiedAt,
        nextDueAt,
        notes: dto.notes?.trim(),
        createdBy: actorId
      },
      include: { worksite: { select: { name: true } } }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_EQUIPMENT_CREATED",
      entityType: "SsmPsiEquipment",
      entityId: created.id,
      payload: { code: created.code, worksiteId: dto.worksiteId, category: dto.category }
    });

    return mapEquipment(created);
  }

  async updateEquipment(tenantId: string, actorId: string, equipmentId: string, dto: UpdateSsmPsiEquipmentDto) {
    const existing = await this.prisma.ssmPsiEquipment.findFirst({ where: { id: equipmentId, tenantId } });
    if (!existing) throw new NotFoundException("PSI equipment not found.");

    const updated = await this.prisma.ssmPsiEquipment.update({
      where: { id: equipmentId },
      data: {
        name: dto.name?.trim(),
        category: dto.category,
        serialNumber: dto.serialNumber?.trim(),
        location: dto.location?.trim(),
        verificationIntervalDays: dto.verificationIntervalDays,
        reminderDays: dto.reminderDays,
        notes: dto.notes?.trim(),
        status: dto.status
      },
      include: { worksite: { select: { name: true } } }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_EQUIPMENT_UPDATED",
      entityType: "SsmPsiEquipment",
      entityId: equipmentId,
      payload: { ...dto }
    });

    return mapEquipment(updated);
  }

  async retireEquipment(tenantId: string, actorId: string, equipmentId: string) {
    return this.updateEquipment(tenantId, actorId, equipmentId, { status: SsmPsiEquipmentStatus.RETIRED });
  }

  async listVerifications(tenantId: string, equipmentId: string) {
    const equipment = await this.prisma.ssmPsiEquipment.findFirst({ where: { id: equipmentId, tenantId } });
    if (!equipment) throw new NotFoundException("PSI equipment not found.");

    const rows = await this.prisma.ssmPsiEquipmentVerification.findMany({
      where: { tenantId, equipmentId },
      orderBy: { performedAt: "desc" },
      take: 50
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId,
        performedAt: row.performedAt.toISOString(),
        nextDueAt: row.nextDueAt.toISOString(),
        result: row.result,
        notes: row.notes,
        documentId: row.documentId,
        createdAt: row.createdAt.toISOString()
      }))
    };
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

  private async listDueEquipmentReminders(tenantId: string) {
    const rows = await this.prisma.ssmPsiEquipment.findMany({
      where: { tenantId, status: SsmPsiEquipmentStatus.ACTIVE, nextDueAt: { not: null } },
      include: { worksite: { select: { id: true, name: true } } }
    });
    const now = new Date();
    return rows
      .map((row) => {
        const daysUntilDue = daysUntil(row.nextDueAt!, now);
        return {
          equipmentId: row.id,
          code: row.code,
          name: row.name,
          worksiteId: row.worksiteId,
          worksiteName: row.worksite.name,
          nextDueAt: row.nextDueAt!,
          daysUntilDue,
          reminderDays: row.reminderDays
        };
      })
      .filter((item) => item.reminderDays.includes(item.daysUntilDue) || item.daysUntilDue < 0)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  async equipmentNotifications(tenantId: string) {
    const reminders = await this.listDueEquipmentReminders(tenantId);
    return {
      reminders: reminders.map((item) => ({
        equipmentId: item.equipmentId,
        code: item.code,
        name: item.name,
        worksiteName: item.worksiteName,
        nextDueAt: item.nextDueAt.toISOString(),
        daysUntilDue: item.daysUntilDue
      }))
    };
  }

  /** Remindere PSI scadente — cron zilnic + trigger manual. */
  async dispatchReminders(tenantId: string, actorId: string) {
    const reminders = await this.listDueEquipmentReminders(tenantId);
    const responsibles = await this.prisma.ssmPsiResponsible.findMany({
      where: { tenantId, active: true },
      select: { email: true, worksiteId: true, personName: true, employeeId: true, role: true }
    });

    let sentEmail = 0;
    let sentInApp = 0;

    for (const reminder of reminders) {
      const reminderText =
        reminder.daysUntilDue < 0
          ? `Echipament PSI ${reminder.code} (${reminder.name}) pe ${reminder.worksiteName} este restant cu ${Math.abs(reminder.daysUntilDue)} zile (scadență ${reminder.nextDueAt.toLocaleDateString("ro-RO")}).`
          : `Echipament PSI ${reminder.code} (${reminder.name}) pe ${reminder.worksiteName} expiră în ${reminder.daysUntilDue} zile (scadență ${reminder.nextDueAt.toLocaleDateString("ro-RO")}).`;

      const targets = responsibles.filter(
        (row) => row.worksiteId === reminder.worksiteId && (row.email || row.employeeId)
      );

      const emailSent = await this.prisma.ssmPsiReminderDispatch.findUnique({
        where: {
          equipmentId_daysUntilDue_channel: {
            equipmentId: reminder.equipmentId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "email"
          }
        }
      });
      if (!emailSent) {
        let anyEmail = false;
        for (const responsible of targets) {
          if (!responsible.email) continue;
          await this.mailService.sendMail({
            to: responsible.email,
            subject: `Reminder PSI: ${reminder.code}`,
            text: `${reminderText}\nResponsabil: ${responsible.personName} (${responsible.role})`
          });
          anyEmail = true;
        }
        if (anyEmail) {
          await this.prisma.ssmPsiReminderDispatch.create({
            data: {
              tenantId,
              equipmentId: reminder.equipmentId,
              daysUntilDue: reminder.daysUntilDue,
              channel: "email"
            }
          });
          sentEmail += 1;
        }
      }

      const inAppSent = await this.prisma.ssmPsiReminderDispatch.findUnique({
        where: {
          equipmentId_daysUntilDue_channel: {
            equipmentId: reminder.equipmentId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "in_app"
          }
        }
      });
      if (!inAppSent) {
        let anyInApp = false;
        for (const responsible of targets) {
          if (responsible.employeeId) {
            const notified = await this.notifications.notifyEmployee({
              tenantId,
              employeeId: responsible.employeeId,
              category: "SSM_PSI",
              title: `Reminder PSI: ${reminder.code}`,
              body: reminderText,
              linkPath: "/ssm",
              entityType: "SsmPsiEquipment",
              entityId: reminder.equipmentId
            });
            if (notified) anyInApp = true;
          } else if (responsible.email) {
            const notified = await this.notifications.notifyEmployeeByEmail(tenantId, responsible.email, {
              category: "SSM_PSI",
              title: `Reminder PSI: ${reminder.code}`,
              body: reminderText,
              linkPath: "/ssm",
              entityType: "SsmPsiEquipment",
              entityId: reminder.equipmentId
            });
            if (notified) anyInApp = true;
          }
        }
        if (anyInApp) {
          await this.prisma.ssmPsiReminderDispatch.create({
            data: {
              tenantId,
              equipmentId: reminder.equipmentId,
              daysUntilDue: reminder.daysUntilDue,
              channel: "in_app"
            }
          });
          sentInApp += 1;
        }
      }
    }

    const sent = sentEmail + sentInApp;
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_REMINDERS_DISPATCHED",
      entityType: "SsmPsiReminderDispatch",
      entityId: tenantId,
      payload: { sent, sentEmail, sentInApp, candidates: reminders.length }
    });

    return { sent, sentEmail, sentInApp, candidates: reminders.length };
  }

  async listTrainingRecords(tenantId: string) {
    const [psiRows, suitePlans, trainingTypes] = await Promise.all([
      this.prisma.ssmPsiTrainingRecord.findMany({
        where: { tenantId },
        include: {
          employee: { select: { fullName: true } },
          worksite: { select: { name: true } }
        },
        orderBy: { conductedAt: "desc" },
        take: 200
      }),
      this.prisma.ssmTrainingPlan.findMany({
        where: {
          tenantId,
          trainingType: { category: SsmTrainingCategory.EMERGENCY_PSI }
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              worksiteId: true,
              worksite: { select: { id: true, name: true } }
            }
          },
          trainingType: { select: { id: true, name: true, category: true } }
        },
        orderBy: { scheduledAt: "desc" },
        take: 200
      }),
      this.prisma.ssmTrainingType.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, category: true }
      })
    ]);

    const typeById = new Map(trainingTypes.map((row) => [row.id, row]));

    const registerItems = psiRows.map((row) => {
      const linkedType = row.trainingTypeId ? typeById.get(row.trainingTypeId) : undefined;
      return {
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite.name,
        employeeId: row.employeeId,
        employeeName: row.employee?.fullName ?? null,
        trainingTypeId: row.trainingTypeId,
        trainingTypeName: linkedType?.name ?? null,
        trainingTypeCategory: linkedType?.category ?? null,
        topic: row.topic,
        conductedAt: row.conductedAt.toISOString(),
        validUntil: row.validUntil?.toISOString() ?? null,
        trainerName: row.trainerName,
        responsibleName: row.responsibleName,
        evidenceDocumentId: row.evidenceDocumentId,
        notes: row.notes,
        source: "PSI_REGISTER" as const
      };
    });

    const suiteItems = suitePlans.map((plan) => ({
      id: plan.id,
      worksiteId: plan.employee.worksiteId ?? "",
      worksiteName: plan.employee.worksite?.name ?? "—",
      employeeId: plan.employeeId,
      employeeName: plan.employee.fullName,
      trainingTypeId: plan.trainingTypeId,
      trainingTypeName: plan.trainingType.name,
      trainingTypeCategory: plan.trainingType.category,
      topic: plan.trainingType.name,
      conductedAt: (plan.completedAt ?? plan.scheduledAt).toISOString(),
      validUntil: plan.dueAt?.toISOString() ?? null,
      trainerName: "Suite instruire SSM",
      responsibleName: null,
      evidenceDocumentId: null,
      notes: `Status plan: ${plan.status}`,
      source: "TRAINING_SUITE" as const
    }));

    const items = [...registerItems, ...suiteItems].sort(
      (a, b) => new Date(b.conductedAt).getTime() - new Date(a.conductedAt).getTime()
    );

    return { items };
  }

  async createTrainingRecord(tenantId: string, actorId: string, dto: CreateSsmPsiTrainingRecordDto) {
    await this.assertWorksite(tenantId, dto.worksiteId);
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, active: true } });
      if (!employee) throw new NotFoundException("Employee not found for tenant.");
    }
    let trainingTypeName: string | null = null;
    let trainingTypeCategory: string | null = null;
    if (dto.trainingTypeId) {
      const trainingType = await this.prisma.ssmTrainingType.findFirst({
        where: { id: dto.trainingTypeId, tenantId, active: true }
      });
      if (!trainingType) throw new NotFoundException("Training type not found for tenant.");
      trainingTypeName = trainingType.name;
      trainingTypeCategory = trainingType.category;
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
      },
      include: {
        employee: { select: { fullName: true } },
        worksite: { select: { name: true } }
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "PSI_TRAINING_RECORDED",
      entityType: "SsmPsiTrainingRecord",
      entityId: created.id,
      payload: { trainingTypeId: dto.trainingTypeId ?? null }
    });

    return {
      id: created.id,
      worksiteId: created.worksiteId,
      worksiteName: created.worksite.name,
      employeeId: created.employeeId,
      employeeName: created.employee?.fullName ?? null,
      trainingTypeId: created.trainingTypeId,
      trainingTypeName,
      trainingTypeCategory,
      topic: created.topic,
      conductedAt: created.conductedAt.toISOString(),
      validUntil: created.validUntil?.toISOString() ?? null,
      trainerName: created.trainerName,
      responsibleName: created.responsibleName,
      evidenceDocumentId: created.evidenceDocumentId,
      notes: created.notes,
      source: "PSI_REGISTER" as const
    };
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
      },
      include: {
        worksite: { select: { name: true } },
        employee: { select: { fullName: true } }
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

    return {
      id: created.id,
      worksiteId: created.worksiteId,
      worksiteName: created.worksite.name,
      employeeId: created.employeeId,
      employeeName: created.employee?.fullName ?? null,
      role: created.role,
      personName: created.personName,
      email: created.email,
      phone: created.phone,
      active: created.active,
      notes: created.notes
    };
  }
}
