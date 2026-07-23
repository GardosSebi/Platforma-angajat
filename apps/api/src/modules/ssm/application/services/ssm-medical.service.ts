import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { extname, resolve } from "path";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile
} from "@nestjs/common";
import { SsmMedicalControlCategory, SsmMedicalControlResult } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import {
  CreateMedicalControlDto,
  CreateMedicalControlTypeDto,
  UpdateMedicalControlDto
} from "../../api/dto/ssm-medical.dto";
import { findEmployeeIdForUserEmail } from "../../api/ssm-viewer-scope";
import { SsmTrainingAutomationService } from "./ssm-training-automation.service";

const MEDICAL_ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const MEDICAL_ALLOWED_MIME_PREFIXES = ["application/pdf", "image/"];
const MEDICAL_MAX_FILE_BYTES = 25 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_DEFAULTS: Record<
  SsmMedicalControlCategory,
  { codePrefix: string; name: string; recurrenceDays?: number }
> = {
  HIRE: { codePrefix: "MED-HIRE", name: "Control medical la angajare" },
  PERIODIC: { codePrefix: "MED-PERIODIC", name: "Control medical periodic", recurrenceDays: 365 },
  RESUME: { codePrefix: "MED-RESUME", name: "Control medical la reluare activitate" },
  JOB_CHANGE: { codePrefix: "MED-JOBCHG", name: "Control medical la schimbare post" }
};

function parseDate(value: string, fieldName: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }
  return d;
}

function daysDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

@Injectable()
export class SsmMedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly trainingAutomation: SsmTrainingAutomationService
  ) {}

  private assertAptitudeSheet(file?: Express.Multer.File) {
    if (!file) {
      return;
    }
    if (file.size > MEDICAL_MAX_FILE_BYTES) {
      throw new BadRequestException("Aptitude sheet file too large. Max 25MB.");
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!MEDICAL_ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException("Only PDF/JPG/PNG aptitude sheets are allowed.");
    }
    if (!MEDICAL_ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix))) {
      throw new BadRequestException("Unsupported aptitude sheet format.");
    }
  }

  private async persistAptitudeSheet(
    tenantId: string,
    controlId: string,
    file: Express.Multer.File
  ): Promise<string> {
    const safeName = sanitizeFilename(file.originalname);
    const targetDir = resolve(process.cwd(), "uploads", "ssm-medical", tenantId, controlId);
    await mkdir(targetDir, { recursive: true });
    const absolutePath = resolve(targetDir, `${Date.now()}-${safeName}`);
    await writeFile(absolutePath, file.buffer);
    return absolutePath;
  }

  async listControlTypes(tenantId: string) {
    const rows = await this.prisma.ssmMedicalControlType.findMany({
      where: { tenantId },
      include: {
        jobPosition: { select: { id: true, name: true } }
      },
      orderBy: [{ active: "desc" }, { category: "asc" }, { code: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      jobPositionId: row.jobPositionId,
      jobPositionName: row.jobPosition?.name ?? null,
      recurrenceDays: row.recurrenceDays,
      reminderDays: row.reminderDays,
      active: row.active
    }));
  }

  async createControlType(tenantId: string, actorId: string, dto: CreateMedicalControlTypeDto) {
    const position = await this.prisma.jobPosition.findFirst({
      where: {
        id: dto.jobPositionId,
        tenantId,
        active: true
      }
    });
    if (!position) {
      throw new NotFoundException("Job position not found for tenant.");
    }

    const created = await this.prisma.ssmMedicalControlType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        jobPositionId: dto.jobPositionId.trim(),
        category: dto.category,
        recurrenceDays: dto.recurrenceDays,
        reminderDays: dto.reminderDays ?? [30, 15, 7],
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "MEDICAL_CONTROL_TYPE_CREATED",
      entityType: "SsmMedicalControlType",
      entityId: created.id,
      payload: { code: created.code, category: created.category }
    });

    return created;
  }

  async ensureControlType(
    tenantId: string,
    actorId: string,
    category: SsmMedicalControlCategory,
    jobPositionId: string
  ) {
    const existing = await this.prisma.ssmMedicalControlType.findFirst({
      where: { tenantId, category, jobPositionId, active: true }
    });
    if (existing) return existing;

    const def = CATEGORY_DEFAULTS[category];
    const code = `${def.codePrefix}-${jobPositionId.slice(-6).toUpperCase()}`;
    return this.prisma.ssmMedicalControlType.create({
      data: {
        tenantId,
        jobPositionId,
        category,
        code,
        name: def.name,
        recurrenceDays: def.recurrenceDays,
        reminderDays: [30, 15, 7],
        createdBy: actorId
      }
    });
  }

  async scheduleControlForCategory(
    tenantId: string,
    actorId: string,
    employeeId: string,
    category: SsmMedicalControlCategory,
    reason: string
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, active: true },
      select: { id: true, jobPositionId: true, fullName: true }
    });
    if (!employee?.jobPositionId) {
      return null;
    }

    const controlType = await this.ensureControlType(tenantId, actorId, category, employee.jobPositionId);

    const openExisting = await this.prisma.ssmMedicalControl.findFirst({
      where: {
        tenantId,
        employeeId,
        controlTypeId: controlType.id,
        OR: [{ result: null }, { performedAt: null }]
      }
    });
    if (openExisting) {
      return openExisting;
    }

    const now = new Date();
    const created = await this.prisma.ssmMedicalControl.create({
      data: {
        tenantId,
        employeeId,
        controlTypeId: controlType.id,
        scheduledAt: now,
        nextDueAt: now,
        createdBy: actorId,
        recommendations: reason
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "MEDICAL_CONTROL_AUTO_SCHEDULED",
      entityType: "SsmMedicalControl",
      entityId: created.id,
      payload: { employeeId, category, reason }
    });

    await this.notifications.notifyEmployee({
      tenantId,
      employeeId,
      category: "SSM_MEDICAL",
      title: `Control medical programat: ${controlType.name}`,
      body: reason,
      linkPath: "/portal?tab=medical",
      entityType: "SsmMedicalControl",
      entityId: created.id
    });

    return created;
  }

  async scheduleOnHire(tenantId: string, actorId: string, employeeId: string) {
    return this.scheduleControlForCategory(
      tenantId,
      actorId,
      employeeId,
      SsmMedicalControlCategory.HIRE,
      "Flux automat: control medical la angajare"
    );
  }

  async scheduleOnJobChange(tenantId: string, actorId: string, employeeId: string) {
    return this.scheduleControlForCategory(
      tenantId,
      actorId,
      employeeId,
      SsmMedicalControlCategory.JOB_CHANGE,
      "Flux automat: control medical la schimbare post / loc de muncă"
    );
  }

  async scheduleOnResume(tenantId: string, actorId: string, employeeId: string) {
    return this.scheduleControlForCategory(
      tenantId,
      actorId,
      employeeId,
      SsmMedicalControlCategory.RESUME,
      "Flux automat: control medical la reluare activitate"
    );
  }

  async createControl(
    tenantId: string,
    actorId: string,
    dto: CreateMedicalControlDto,
    aptitudeSheet?: Express.Multer.File
  ) {
    this.assertAptitudeSheet(aptitudeSheet);

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        tenantId,
        active: true
      }
    });
    if (!employee) {
      throw new NotFoundException("Employee not found for tenant.");
    }

    const controlType = await this.prisma.ssmMedicalControlType.findFirst({
      where: {
        id: dto.controlTypeId,
        tenantId,
        active: true
      }
    });
    if (!controlType) {
      throw new NotFoundException("Medical control type not found for tenant.");
    }

    const scheduledAt = parseDate(dto.scheduledAt, "scheduledAt");
    const performedAt = dto.performedAt ? parseDate(dto.performedAt, "performedAt") : undefined;
    const validityUntil = dto.validityUntil ? parseDate(dto.validityUntil, "validityUntil") : undefined;

    if (performedAt && performedAt < scheduledAt) {
      throw new BadRequestException("performedAt must be after scheduledAt.");
    }

    const baseDate = validityUntil ?? performedAt ?? scheduledAt;
    const nextDueAt =
      controlType.recurrenceDays && controlType.recurrenceDays > 0
        ? new Date(baseDate.getTime() + controlType.recurrenceDays * DAY_MS)
        : undefined;

    const previousControl = await this.prisma.ssmMedicalControl.findFirst({
      where: { tenantId, employeeId: employee.id },
      orderBy: { scheduledAt: "desc" }
    });

    const created = await this.prisma.ssmMedicalControl.create({
      data: {
        tenantId,
        employeeId: employee.id,
        controlTypeId: controlType.id,
        scheduledAt,
        performedAt,
        result: dto.result,
        recommendations: dto.recommendations?.trim(),
        validityUntil,
        nextDueAt,
        createdBy: actorId
      }
    });

    if (aptitudeSheet) {
      const storagePath = await this.persistAptitudeSheet(tenantId, created.id, aptitudeSheet);
      await this.prisma.ssmMedicalControl.update({
        where: { id: created.id },
        data: {
          aptitudeSheetPath: storagePath,
          aptitudeSheetName: aptitudeSheet.originalname,
          aptitudeSheetMime: aptitudeSheet.mimetype,
          aptitudeSheetSize: aptitudeSheet.size
        }
      });
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "MEDICAL_CONTROL_SAVED",
      entityType: "SsmMedicalControl",
      entityId: created.id,
      payload: {
        employeeId: employee.id,
        result: dto.result ?? null
      }
    });

    if (
      dto.result === SsmMedicalControlResult.FIT &&
      previousControl?.result === SsmMedicalControlResult.TEMPORARY_UNFIT
    ) {
      await this.trainingAutomation.assignOnMedicalResume(tenantId, actorId, employee.id);
    }

    return created;
  }

  async updateControl(
    tenantId: string,
    actorId: string,
    controlId: string,
    dto: UpdateMedicalControlDto,
    aptitudeSheet?: Express.Multer.File
  ) {
    this.assertAptitudeSheet(aptitudeSheet);

    const existing = await this.prisma.ssmMedicalControl.findFirst({
      where: { id: controlId, tenantId },
      include: { controlType: true }
    });
    if (!existing) {
      throw new NotFoundException("Medical control not found.");
    }

    const performedAt = dto.performedAt
      ? parseDate(dto.performedAt, "performedAt")
      : existing.performedAt ?? undefined;
    const validityUntil =
      dto.validityUntil !== undefined ? parseDate(dto.validityUntil, "validityUntil") : existing.validityUntil;
    const result = dto.result !== undefined ? dto.result : existing.result;

    if (performedAt && performedAt < existing.scheduledAt) {
      throw new BadRequestException("performedAt must be after scheduledAt.");
    }

    const baseDate = (validityUntil ?? performedAt ?? existing.scheduledAt) as Date;
    const nextDueAt =
      existing.controlType.recurrenceDays && existing.controlType.recurrenceDays > 0
        ? new Date(baseDate.getTime() + existing.controlType.recurrenceDays * DAY_MS)
        : existing.nextDueAt;

    const data: {
      performedAt?: Date | null;
      result?: SsmMedicalControlResult | null;
      recommendations?: string | null;
      validityUntil?: Date | null;
      nextDueAt?: Date | null;
      aptitudeSheetPath?: string;
      aptitudeSheetName?: string;
      aptitudeSheetMime?: string;
      aptitudeSheetSize?: number;
    } = {
      performedAt: performedAt ?? null,
      result: result ?? null,
      recommendations:
        dto.recommendations !== undefined ? dto.recommendations.trim() || null : existing.recommendations,
      validityUntil: validityUntil ?? null,
      nextDueAt: nextDueAt ?? null
    };

    if (aptitudeSheet) {
      const storagePath = await this.persistAptitudeSheet(tenantId, existing.id, aptitudeSheet);
      data.aptitudeSheetPath = storagePath;
      data.aptitudeSheetName = aptitudeSheet.originalname;
      data.aptitudeSheetMime = aptitudeSheet.mimetype;
      data.aptitudeSheetSize = aptitudeSheet.size;
    }

    const updated = await this.prisma.ssmMedicalControl.update({
      where: { id: existing.id },
      data
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "MEDICAL_CONTROL_UPDATED",
      entityType: "SsmMedicalControl",
      entityId: updated.id,
      payload: {
        result: updated.result,
        aptitudeReplaced: Boolean(aptitudeSheet)
      }
    });

    if (
      result === SsmMedicalControlResult.FIT &&
      existing.result === SsmMedicalControlResult.TEMPORARY_UNFIT
    ) {
      await this.trainingAutomation.assignOnMedicalResume(tenantId, actorId, existing.employeeId);
    }

    return updated;
  }

  async canEmployeeDownloadAptitudeSheet(tenantId: string, controlId: string, userEmail: string) {
    const selfEmployeeId = await findEmployeeIdForUserEmail(this.prisma, tenantId, userEmail);
    if (!selfEmployeeId) return false;
    const control = await this.prisma.ssmMedicalControl.findFirst({
      where: { id: controlId, tenantId, employeeId: selfEmployeeId },
      select: { id: true }
    });
    return Boolean(control);
  }

  async downloadAptitudeSheet(tenantId: string, controlId: string) {
    const control = await this.prisma.ssmMedicalControl.findFirst({
      where: { id: controlId, tenantId }
    });
    if (!control) {
      throw new NotFoundException("Medical control not found.");
    }
    if (!control.aptitudeSheetPath) {
      throw new NotFoundException("Aptitude sheet not attached.");
    }

    const stream = createReadStream(control.aptitudeSheetPath);
    return new StreamableFile(stream, {
      type: control.aptitudeSheetMime ?? "application/octet-stream",
      disposition: `attachment; filename="${sanitizeFilename(control.aptitudeSheetName ?? `aptitudini-${controlId}.pdf`)}"`
    });
  }

  async listControls(tenantId: string) {
    const rows = await this.prisma.ssmMedicalControl.findMany({
      where: { tenantId },
      include: {
        employee: { select: { id: true, fullName: true } },
        controlType: { select: { id: true, code: true, name: true, category: true } }
      },
      orderBy: [{ nextDueAt: "asc" }, { scheduledAt: "desc" }]
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.fullName,
        controlTypeId: row.controlTypeId,
        controlTypeCode: row.controlType.code,
        controlTypeName: row.controlType.name,
        controlTypeCategory: row.controlType.category,
        scheduledAt: row.scheduledAt,
        performedAt: row.performedAt,
        result: row.result as SsmMedicalControlResult | null,
        recommendations: row.recommendations,
        validityUntil: row.validityUntil,
        nextDueAt: row.nextDueAt,
        aptitudeSheetName: row.aptitudeSheetName,
        hasAptitudeSheet: Boolean(row.aptitudeSheetPath)
      }))
    };
  }

  async reminders(tenantId: string) {
    const controls = await this.prisma.ssmMedicalControl.findMany({
      where: {
        tenantId,
        nextDueAt: { not: null }
      },
      include: {
        employee: { select: { fullName: true } },
        controlType: { select: { name: true, reminderDays: true } }
      },
      orderBy: { nextDueAt: "asc" }
    });
    const now = new Date();
    const reminders = controls
      .map((row) => {
        const daysUntilDue = row.nextDueAt ? daysDiff(now, row.nextDueAt) : 0;
        return {
          controlId: row.id,
          employeeName: row.employee.fullName,
          controlTypeName: row.controlType.name,
          nextDueAt: row.nextDueAt!,
          daysUntilDue,
          reminderDays: row.controlType.reminderDays ?? [30, 15, 7]
        };
      })
      .filter((row) => row.daysUntilDue < 0 || row.reminderDays.includes(row.daysUntilDue))
      .map(({ reminderDays: _ignored, ...row }) => row);

    return { reminders };
  }

  /** Remindere controale medicale scadente — cron zilnic. */
  async dispatchMedicalReminders(tenantId: string, actorId: string) {
    const controls = await this.prisma.ssmMedicalControl.findMany({
      where: { tenantId, nextDueAt: { not: null } },
      include: {
        employee: { select: { id: true, email: true, fullName: true } },
        controlType: { select: { name: true, reminderDays: true } }
      }
    });
    const now = new Date();
    let sent = 0;
    for (const row of controls) {
      if (!row.nextDueAt) continue;
      const daysUntilDue = daysDiff(now, row.nextDueAt);
      const reminderDays = row.controlType.reminderDays ?? [30, 15, 7];
      if (daysUntilDue > 0 && !reminderDays.includes(daysUntilDue)) continue;
      if (daysUntilDue > 30) continue;
      const text =
        daysUntilDue < 0
          ? `Control medical (${row.controlType.name}) restant cu ${Math.abs(daysUntilDue)} zile.`
          : `Control medical (${row.controlType.name}) în ${daysUntilDue} zile.`;
      const notified = await this.notifications.notifyEmployee({
        tenantId,
        employeeId: row.employeeId,
        category: "SSM_MEDICAL",
        title: "Reminder medicina muncii",
        body: text,
        linkPath: "/portal?tab=medical",
        entityType: "SsmMedicalControl",
        entityId: row.id
      });
      if (notified) sent += 1;
    }
    if (sent) {
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "MEDICAL_REMINDERS_DISPATCHED",
        entityType: "SsmMedicalControl",
        entityId: "batch",
        payload: { sent }
      });
    }
    return { sent };
  }
}
