import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SsmEipMovementType } from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import { CreateEipMovementDto, CreateEipNormDto, CreateEipTypeDto } from "../../api/dto/ssm-eip.dto";

const EIP_REMINDER_DAYS = [30, 15, 7] as const;

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

export function eipStockScopeKey(worksiteId?: string | null, departmentId?: string | null): string {
  const w = worksiteId?.trim() || null;
  const d = departmentId?.trim() || null;
  if (!w && !d) return "global";
  if (w && d) return `w:${w}|d:${d}`;
  if (w) return `w:${w}`;
  return `d:${d}`;
}

function formatLocationLabel(opts: {
  worksiteName?: string | null;
  departmentName?: string | null;
}): string {
  const parts = [opts.worksiteName, opts.departmentName].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Global";
}

function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class SsmEipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
    private readonly notifications: NotificationsService
  ) {}

  async listTypes(tenantId: string) {
    return this.prisma.ssmEipType.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async createType(tenantId: string, actorId: string, dto: CreateEipTypeDto) {
    const created = await this.prisma.ssmEipType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        defaultLifetimeDays: dto.defaultLifetimeDays
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_TYPE_CREATED",
      entityType: "SsmEipType",
      entityId: created.id
    });
    return created;
  }

  async listNorms(tenantId: string) {
    const rows = await this.prisma.ssmEipNorm.findMany({
      where: { tenantId },
      include: {
        jobPosition: { select: { name: true } },
        eipType: { select: { name: true } }
      },
      orderBy: [{ jobPosition: { name: "asc" } }]
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        jobPositionId: row.jobPositionId,
        jobPositionName: row.jobPosition.name,
        eipTypeId: row.eipTypeId,
        eipTypeName: row.eipType.name,
        requiredQuantity: row.requiredQuantity,
        lifetimeDays: row.lifetimeDays,
        replacementRule: row.replacementRule
      }))
    };
  }

  async upsertNorm(tenantId: string, actorId: string, dto: CreateEipNormDto) {
    const job = await this.prisma.jobPosition.findFirst({
      where: { id: dto.jobPositionId, tenantId, active: true }
    });
    if (!job) throw new NotFoundException("Invalid jobPositionId for tenant.");
    const type = await this.prisma.ssmEipType.findFirst({
      where: { id: dto.eipTypeId, tenantId, active: true }
    });
    if (!type) throw new NotFoundException("Invalid eipTypeId for tenant.");

    const norm = await this.prisma.ssmEipNorm.upsert({
      where: {
        jobPositionId_eipTypeId: {
          jobPositionId: dto.jobPositionId,
          eipTypeId: dto.eipTypeId
        }
      },
      create: {
        tenantId,
        jobPositionId: dto.jobPositionId,
        eipTypeId: dto.eipTypeId,
        requiredQuantity: dto.requiredQuantity,
        lifetimeDays: dto.lifetimeDays,
        replacementRule: dto.replacementRule?.trim(),
        createdBy: actorId
      },
      update: {
        requiredQuantity: dto.requiredQuantity,
        lifetimeDays: dto.lifetimeDays,
        replacementRule: dto.replacementRule?.trim()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_NORM_UPSERTED",
      entityType: "SsmEipNorm",
      entityId: norm.id
    });
    return norm;
  }

  private async resolveLocation(
    tenantId: string,
    dto: CreateEipMovementDto,
    employee?: { worksiteId: string | null; departmentId: string | null } | null
  ) {
    let worksiteId = dto.worksiteId?.trim() || employee?.worksiteId || null;
    let departmentId = dto.departmentId?.trim() || employee?.departmentId || null;

    if (worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: worksiteId, tenantId, active: true }
      });
      if (!worksite) throw new NotFoundException("Invalid worksiteId for tenant.");
    }
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId, active: true }
      });
      if (!department) throw new NotFoundException("Invalid departmentId for tenant.");
      if (department.worksiteId && !worksiteId) {
        worksiteId = department.worksiteId;
      }
    }

    if (dto.movementType === SsmEipMovementType.INTAKE && !worksiteId && !departmentId) {
      throw new BadRequestException("INTAKE requires worksiteId and/or departmentId.");
    }

    return { worksiteId, departmentId, scopeKey: eipStockScopeKey(worksiteId, departmentId) };
  }

  async registerMovement(tenantId: string, actorId: string, dto: CreateEipMovementDto) {
    const type = await this.prisma.ssmEipType.findFirst({
      where: { id: dto.eipTypeId, tenantId, active: true }
    });
    if (!type) throw new NotFoundException("EIP type not found.");

    let employee: { id: string; worksiteId: string | null; departmentId: string | null } | null = null;
    if (dto.movementType === SsmEipMovementType.INTAKE) {
      if (dto.employeeId?.trim()) {
        throw new BadRequestException("INTAKE must not include employeeId.");
      }
    } else {
      if (!dto.employeeId?.trim()) {
        throw new BadRequestException("employeeId is required for this movement type.");
      }
      const found = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, tenantId, active: true },
        select: { id: true, worksiteId: true, departmentId: true }
      });
      if (!found) throw new NotFoundException("Employee not found.");
      employee = found;
    }

    const location = await this.resolveLocation(tenantId, dto, employee);

    const dueAt =
      dto.movementType === SsmEipMovementType.DISTRIBUTION
        ? parseOptionalDate(dto.replacementDueAt) ??
          (type.defaultLifetimeDays
            ? new Date(Date.now() + type.defaultLifetimeDays * 24 * 60 * 60 * 1000)
            : undefined)
        : undefined;

    const stock = await this.prisma.ssmEipStock.upsert({
      where: {
        tenantId_eipTypeId_scopeKey: {
          tenantId,
          eipTypeId: dto.eipTypeId,
          scopeKey: location.scopeKey
        }
      },
      create: {
        tenantId,
        eipTypeId: dto.eipTypeId,
        worksiteId: location.worksiteId,
        departmentId: location.departmentId,
        scopeKey: location.scopeKey,
        quantityOnHand: 0,
        minimumThreshold: 0
      },
      update: {}
    });

    let stockDelta = 0;
    if (dto.movementType === SsmEipMovementType.INTAKE) stockDelta = dto.quantity;
    if (dto.movementType === SsmEipMovementType.DISTRIBUTION) stockDelta = -dto.quantity;
    if (dto.movementType === SsmEipMovementType.RETURN) stockDelta = dto.quantity;
    if (dto.movementType === SsmEipMovementType.SCRAP) stockDelta = -dto.quantity;
    if (stock.quantityOnHand + stockDelta < 0) {
      throw new BadRequestException("Insufficient stock for this movement at the selected location.");
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.ssmEipStock.update({
        where: { id: stock.id },
        data: { quantityOnHand: stock.quantityOnHand + stockDelta }
      });
      return tx.ssmEipMovement.create({
        data: {
          tenantId,
          employeeId: employee?.id ?? null,
          eipTypeId: dto.eipTypeId,
          worksiteId: location.worksiteId,
          departmentId: location.departmentId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          replacementDueAt: dueAt,
          signatureData: dto.signatureData,
          signedAt: dto.signatureData ? new Date() : null,
          notes: dto.notes?.trim(),
          createdBy: actorId
        }
      });
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_MOVEMENT_REGISTERED",
      entityType: "SsmEipMovement",
      entityId: movement.id,
      payload: { movementType: dto.movementType, quantity: dto.quantity, scopeKey: location.scopeKey }
    });

    return movement;
  }

  async movementRegister(tenantId: string) {
    const rows = await this.prisma.ssmEipMovement.findMany({
      where: { tenantId },
      include: {
        employee: { select: { fullName: true } },
        eipType: { select: { name: true } },
        worksite: { select: { name: true } },
        department: { select: { name: true } }
      },
      orderBy: { movementDate: "desc" },
      take: 200
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee?.fullName ?? null,
        eipTypeId: row.eipTypeId,
        eipTypeName: row.eipType.name,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite?.name ?? null,
        departmentId: row.departmentId,
        departmentName: row.department?.name ?? null,
        movementType: row.movementType,
        quantity: row.quantity,
        movementDate: row.movementDate,
        replacementDueAt: row.replacementDueAt,
        signedAt: row.signedAt,
        notes: row.notes
      }))
    };
  }

  async registerPdf(tenantId: string) {
    const rows = await this.prisma.ssmEipMovement.findMany({
      where: {
        tenantId,
        movementType: { in: [SsmEipMovementType.DISTRIBUTION, SsmEipMovementType.RETURN, SsmEipMovementType.SCRAP] }
      },
      include: {
        employee: { select: { fullName: true } },
        eipType: { select: { code: true, name: true } },
        worksite: { select: { name: true } },
        department: { select: { name: true } }
      },
      orderBy: { movementDate: "asc" },
      take: 500
    });

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("Registru de acordare EIP", { align: "center" });
      doc.moveDown(0.4);
      doc.fontSize(10).text(`Generat: ${new Date().toLocaleString("ro-RO")}`, { align: "center" });
      doc.moveDown();

      const colX = [36, 110, 250, 340, 420, 500, 580, 680];
      const drawHeader = () => {
        doc.fontSize(8).font("Helvetica-Bold");
        doc.text("Data", colX[0], doc.y, { width: 70, continued: false });
        const y = doc.y - 10;
        doc.text("Angajat", colX[1], y, { width: 130 });
        doc.text("EIP", colX[2], y, { width: 85 });
        doc.text("Operatie", colX[3], y, { width: 70 });
        doc.text("Cant.", colX[4], y, { width: 40 });
        doc.text("Locatie", colX[5], y, { width: 75 });
        doc.text("Inlocuire", colX[6], y, { width: 80 });
        doc.text("Semnatura", colX[7], y, { width: 90 });
        doc.moveDown(0.6);
        doc
          .moveTo(36, doc.y)
          .lineTo(806, doc.y)
          .stroke();
        doc.moveDown(0.4);
        doc.font("Helvetica");
      };

      drawHeader();

      for (const row of rows) {
        if (doc.y > 520) {
          doc.addPage();
          drawHeader();
        }
        const y = doc.y;
        const location = formatLocationLabel({
          worksiteName: row.worksite?.name,
          departmentName: row.department?.name
        });
        doc.fontSize(8);
        doc.text(row.movementDate.toLocaleDateString("ro-RO"), colX[0], y, { width: 70 });
        doc.text(row.employee?.fullName ?? "—", colX[1], y, { width: 130 });
        doc.text(`${row.eipType.code} ${row.eipType.name}`, colX[2], y, { width: 85 });
        doc.text(row.movementType, colX[3], y, { width: 70 });
        doc.text(String(row.quantity), colX[4], y, { width: 40 });
        doc.text(location, colX[5], y, { width: 75 });
        doc.text(
          row.replacementDueAt ? row.replacementDueAt.toLocaleDateString("ro-RO") : "—",
          colX[6],
          y,
          { width: 80 }
        );

        if (row.signatureData?.startsWith("data:image")) {
          try {
            const base64 = row.signatureData.split(",")[1];
            if (base64) {
              doc.image(Buffer.from(base64, "base64"), colX[7], y - 2, { width: 70, height: 22 });
            } else {
              doc.text(row.signedAt ? "Semnat" : "—", colX[7], y, { width: 90 });
            }
          } catch {
            doc.text(row.signedAt ? "Semnat" : "—", colX[7], y, { width: 90 });
          }
        } else {
          doc.text(row.signedAt ? "Semnat" : "—", colX[7], y, { width: 90 });
        }
        doc.y = Math.max(doc.y, y + 28);
      }

      doc.end();
    });
  }

  private async listDueReminders(tenantId: string) {
    const rows = await this.prisma.ssmEipMovement.findMany({
      where: {
        tenantId,
        movementType: SsmEipMovementType.DISTRIBUTION,
        replacementDueAt: { not: null },
        employeeId: { not: null }
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        eipType: { select: { name: true, code: true } },
        worksite: { select: { id: true, name: true } }
      }
    });
    const now = new Date();
    return rows
      .map((row) => {
        const daysUntilDue = daysUntil(row.replacementDueAt!, now);
        return {
          movementId: row.id,
          employeeId: row.employeeId!,
          employeeName: row.employee?.fullName ?? "—",
          employeeEmail: row.employee?.email ?? null,
          eipTypeName: row.eipType.name,
          eipTypeCode: row.eipType.code,
          worksiteId: row.worksiteId,
          worksiteName: row.worksite?.name ?? null,
          replacementDueAt: row.replacementDueAt!,
          daysUntilDue
        };
      })
      .filter(
        (item) =>
          item.daysUntilDue < 0 || (EIP_REMINDER_DAYS as readonly number[]).includes(item.daysUntilDue)
      )
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  async dueNotifications(tenantId: string) {
    const reminders = await this.listDueReminders(tenantId);
    return {
      reminders: reminders.map((item) => ({
        movementId: item.movementId,
        employeeName: item.employeeName,
        eipTypeName: item.eipTypeName,
        replacementDueAt: item.replacementDueAt,
        daysUntilDue: item.daysUntilDue,
        worksiteName: item.worksiteName
      }))
    };
  }

  /** Remindere EIP scadente — cron zilnic + trigger manual. */
  async dispatchReminders(tenantId: string, actorId: string) {
    const reminders = await this.listDueReminders(tenantId);
    const responsibles = await this.prisma.ssmResponsible.findMany({
      where: { tenantId, active: true, email: { not: null } },
      select: { email: true, worksiteId: true, personName: true }
    });

    let sentEmail = 0;
    let sentInApp = 0;
    let sentResponsible = 0;

    for (const reminder of reminders) {
      const reminderText =
        reminder.daysUntilDue < 0
          ? `EIP ${reminder.eipTypeName} pentru ${reminder.employeeName} este restant cu ${Math.abs(reminder.daysUntilDue)} zile (scadență ${reminder.replacementDueAt.toLocaleDateString("ro-RO")}).`
          : `EIP ${reminder.eipTypeName} pentru ${reminder.employeeName} expiră în ${reminder.daysUntilDue} zile (scadență ${reminder.replacementDueAt.toLocaleDateString("ro-RO")}).`;

      const emailSent = await this.prisma.ssmEipReminderDispatch.findUnique({
        where: {
          eipMovementId_daysUntilDue_channel: {
            eipMovementId: reminder.movementId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "email"
          }
        }
      });
      if (!emailSent && reminder.employeeEmail) {
        await this.mailService.sendMail({
          to: reminder.employeeEmail,
          subject: `Reminder EIP: ${reminder.eipTypeName}`,
          text: reminderText
        });
        await this.prisma.ssmEipReminderDispatch.create({
          data: {
            tenantId,
            eipMovementId: reminder.movementId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "email"
          }
        });
        sentEmail += 1;
      }

      const inAppSent = await this.prisma.ssmEipReminderDispatch.findUnique({
        where: {
          eipMovementId_daysUntilDue_channel: {
            eipMovementId: reminder.movementId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "in_app"
          }
        }
      });
      if (!inAppSent) {
        const notified = await this.notifications.notifyEmployee({
          tenantId,
          employeeId: reminder.employeeId,
          category: "SSM_EIP",
          title: `Reminder EIP: ${reminder.eipTypeName}`,
          body: reminderText,
          linkPath: "/ssm",
          entityType: "SsmEipMovement",
          entityId: reminder.movementId
        });
        if (notified) {
          await this.prisma.ssmEipReminderDispatch.create({
            data: {
              tenantId,
              eipMovementId: reminder.movementId,
              daysUntilDue: reminder.daysUntilDue,
              channel: "in_app"
            }
          });
          sentInApp += 1;
        }
      }

      const responsibleSent = await this.prisma.ssmEipReminderDispatch.findUnique({
        where: {
          eipMovementId_daysUntilDue_channel: {
            eipMovementId: reminder.movementId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "ssm_responsible"
          }
        }
      });
      if (!responsibleSent) {
        const targets = responsibles.filter(
          (row) => row.email && (!row.worksiteId || row.worksiteId === reminder.worksiteId)
        );
        let anySent = false;
        for (const responsible of targets) {
          await this.mailService.sendMail({
            to: responsible.email!,
            subject: `Alerte EIP SSM: ${reminder.eipTypeName}`,
            text: `${reminderText}\n\nResponsabil: ${responsible.personName}`
          });
          anySent = true;
          sentResponsible += 1;
        }
        if (anySent || targets.length === 0) {
          // Mark as processed even if no responsible matched, to avoid retry spam for orphan scopes.
          await this.prisma.ssmEipReminderDispatch.create({
            data: {
              tenantId,
              eipMovementId: reminder.movementId,
              daysUntilDue: reminder.daysUntilDue,
              channel: "ssm_responsible"
            }
          });
        }
      }
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_REMINDERS_DISPATCHED",
      entityType: "SsmEipReminderDispatch",
      entityId: "batch",
      payload: {
        candidates: reminders.length,
        sentEmail,
        sentInApp,
        sentResponsible
      }
    });

    return {
      candidates: reminders.length,
      sent: sentEmail + sentInApp + sentResponsible,
      sentEmail,
      sentInApp,
      sentResponsible
    };
  }

  async stockGapReport(tenantId: string) {
    const [norms, stocks, activeDistributions] = await Promise.all([
      this.prisma.ssmEipNorm.findMany({
        where: { tenantId },
        include: {
          eipType: { select: { id: true, name: true } },
          jobPosition: { select: { worksiteId: true, departmentId: true, worksite: { select: { name: true } }, department: { select: { name: true } } } }
        }
      }),
      this.prisma.ssmEipStock.findMany({
        where: { tenantId },
        include: {
          eipType: { select: { id: true, name: true } },
          worksite: { select: { name: true } },
          department: { select: { name: true } }
        }
      }),
      this.prisma.ssmEipMovement.groupBy({
        by: ["eipTypeId", "worksiteId", "departmentId"],
        where: { tenantId, movementType: SsmEipMovementType.DISTRIBUTION },
        _sum: { quantity: true }
      })
    ]);

    type Bucket = {
      eipTypeId: string;
      eipTypeName: string;
      worksiteId: string | null;
      worksiteName: string | null;
      departmentId: string | null;
      departmentName: string | null;
      scopeKey: string;
      required: number;
      distributedActive: number;
      stockOnHand: number;
    };

    const buckets = new Map<string, Bucket>();
    const keyOf = (eipTypeId: string, scopeKey: string) => `${eipTypeId}::${scopeKey}`;

    for (const norm of norms) {
      const worksiteId = norm.jobPosition.worksiteId;
      const departmentId = norm.jobPosition.departmentId;
      const scopeKey = eipStockScopeKey(worksiteId, departmentId);
      const key = keyOf(norm.eipTypeId, scopeKey);
      const current = buckets.get(key);
      if (!current) {
        buckets.set(key, {
          eipTypeId: norm.eipTypeId,
          eipTypeName: norm.eipType.name,
          worksiteId,
          worksiteName: norm.jobPosition.worksite?.name ?? null,
          departmentId,
          departmentName: norm.jobPosition.department?.name ?? null,
          scopeKey,
          required: norm.requiredQuantity,
          distributedActive: 0,
          stockOnHand: 0
        });
      } else {
        current.required += norm.requiredQuantity;
      }
    }

    for (const row of activeDistributions) {
      const scopeKey = eipStockScopeKey(row.worksiteId, row.departmentId);
      const key = keyOf(row.eipTypeId, scopeKey);
      let current = buckets.get(key);
      if (!current) {
        current = {
          eipTypeId: row.eipTypeId,
          eipTypeName: "",
          worksiteId: row.worksiteId,
          worksiteName: null,
          departmentId: row.departmentId,
          departmentName: null,
          scopeKey,
          required: 0,
          distributedActive: 0,
          stockOnHand: 0
        };
        buckets.set(key, current);
      }
      current.distributedActive += row._sum.quantity ?? 0;
    }

    for (const stock of stocks) {
      const key = keyOf(stock.eipTypeId, stock.scopeKey);
      let current = buckets.get(key);
      if (!current) {
        current = {
          eipTypeId: stock.eipTypeId,
          eipTypeName: stock.eipType.name,
          worksiteId: stock.worksiteId,
          worksiteName: stock.worksite?.name ?? null,
          departmentId: stock.departmentId,
          departmentName: stock.department?.name ?? null,
          scopeKey: stock.scopeKey,
          required: 0,
          distributedActive: 0,
          stockOnHand: 0
        };
        buckets.set(key, current);
      }
      if (!current.eipTypeName) current.eipTypeName = stock.eipType.name;
      if (!current.worksiteName) current.worksiteName = stock.worksite?.name ?? null;
      if (!current.departmentName) current.departmentName = stock.department?.name ?? null;
      current.stockOnHand = stock.quantityOnHand;
    }

    const typeNames = new Map(
      (await this.prisma.ssmEipType.findMany({ where: { tenantId }, select: { id: true, name: true } })).map(
        (t) => [t.id, t.name] as const
      )
    );

    return {
      items: Array.from(buckets.values()).map((summary) => {
        const shortage = Math.max(summary.required - (summary.distributedActive + summary.stockOnHand), 0);
        return {
          eipTypeId: summary.eipTypeId,
          eipTypeName: summary.eipTypeName || typeNames.get(summary.eipTypeId) || summary.eipTypeId,
          worksiteId: summary.worksiteId,
          worksiteName: summary.worksiteName,
          departmentId: summary.departmentId,
          departmentName: summary.departmentName,
          scopeKey: summary.scopeKey,
          required: summary.required,
          distributedActive: summary.distributedActive,
          stockOnHand: summary.stockOnHand,
          shortage
        };
      })
    };
  }
}
