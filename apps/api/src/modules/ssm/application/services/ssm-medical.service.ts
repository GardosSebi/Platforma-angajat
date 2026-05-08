import { mkdir, writeFile } from "fs/promises";
import { extname, resolve } from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SsmMedicalControlResult } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { CreateMedicalControlDto, CreateMedicalControlTypeDto } from "../../api/dto/ssm-medical.dto";

const MEDICAL_ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const MEDICAL_ALLOWED_MIME_PREFIXES = ["application/pdf", "image/"];
const MEDICAL_MAX_FILE_BYTES = 25 * 1024 * 1024;

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
    private readonly auditLog: AuditLogService
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
      orderBy: [{ active: "desc" }, { code: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      jobPositionId: row.jobPositionId,
      jobPositionName: row.jobPosition?.name ?? null,
      recurrenceDays: row.recurrenceDays,
      reminderDays: row.reminderDays,
      active: row.active
    }));
  }

  async createControlType(tenantId: string, actorId: string, dto: CreateMedicalControlTypeDto) {
    if (dto.jobPositionId) {
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
    }

    const created = await this.prisma.ssmMedicalControlType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        jobPositionId: dto.jobPositionId?.trim(),
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
      payload: { code: created.code }
    });

    return created;
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
        ? new Date(baseDate.getTime() + controlType.recurrenceDays * 24 * 60 * 60 * 1000)
        : undefined;

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

    return created;
  }

  async listControls(tenantId: string) {
    const rows = await this.prisma.ssmMedicalControl.findMany({
      where: { tenantId },
      include: {
        employee: { select: { id: true, fullName: true } },
        controlType: { select: { id: true, code: true, name: true } }
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
        scheduledAt: row.scheduledAt,
        performedAt: row.performedAt,
        result: row.result as SsmMedicalControlResult | null,
        recommendations: row.recommendations,
        validityUntil: row.validityUntil,
        nextDueAt: row.nextDueAt,
        aptitudeSheetName: row.aptitudeSheetName
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
}
