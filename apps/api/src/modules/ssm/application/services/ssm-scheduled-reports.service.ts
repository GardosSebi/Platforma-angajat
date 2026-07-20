import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SsmReportCadence, SsmReportDeliveryFormat } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { SsmOverviewService } from "./ssm-overview.service";

export type CreateScheduledReportInput = {
  reportType: string;
  cadence: SsmReportCadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipients: string[];
  format?: SsmReportDeliveryFormat;
  active?: boolean;
};

@Injectable()
export class SsmScheduledReportsService {
  private readonly logger = new Logger(SsmScheduledReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overview: SsmOverviewService,
    private readonly mail: MailService
  ) {}

  list(tenantId: string) {
    return this.prisma.ssmScheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, actorUserId: string, input: CreateScheduledReportInput) {
    this.assertInput(input);
    const nextRunAt = this.computeNextRun(input.cadence, input.dayOfWeek, input.dayOfMonth);
    return this.prisma.ssmScheduledReport.create({
      data: {
        tenantId,
        reportType: input.reportType,
        cadence: input.cadence,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        recipients: input.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean),
        format: input.format ?? SsmReportDeliveryFormat.PDF,
        active: input.active ?? true,
        nextRunAt,
        createdByUserId: actorUserId
      }
    });
  }

  async update(tenantId: string, id: string, input: Partial<CreateScheduledReportInput>) {
    const existing = await this.prisma.ssmScheduledReport.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Programarea raportului nu a fost găsită.");

    const cadence = input.cadence ?? existing.cadence;
    const dayOfWeek = input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek;
    const dayOfMonth = input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth;
    this.assertInput({
      reportType: input.reportType ?? existing.reportType,
      cadence,
      dayOfWeek,
      dayOfMonth,
      recipients: input.recipients ?? existing.recipients
    });

    return this.prisma.ssmScheduledReport.update({
      where: { id },
      data: {
        ...(input.reportType !== undefined ? { reportType: input.reportType } : {}),
        ...(input.cadence !== undefined ? { cadence: input.cadence } : {}),
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
        ...(input.dayOfMonth !== undefined ? { dayOfMonth: input.dayOfMonth } : {}),
        ...(input.recipients !== undefined
          ? { recipients: input.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean) }
          : {}),
        ...(input.format !== undefined ? { format: input.format } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        nextRunAt: this.computeNextRun(cadence, dayOfWeek, dayOfMonth)
      }
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.ssmScheduledReport.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Programarea raportului nu a fost găsită.");
    await this.prisma.ssmScheduledReport.delete({ where: { id } });
    return { deleted: true };
  }

  async dispatchDueForTenant(tenantId: string) {
    const now = new Date();
    const due = await this.prisma.ssmScheduledReport.findMany({
      where: {
        tenantId,
        active: true,
        OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }]
      }
    });

    let sent = 0;
    for (const schedule of due) {
      try {
        await this.deliver(schedule);
        const nextRunAt = this.computeNextRun(schedule.cadence, schedule.dayOfWeek, schedule.dayOfMonth, now);
        await this.prisma.ssmScheduledReport.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt }
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Scheduled report ${schedule.id} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return { sent };
  }

  private async deliver(schedule: {
    tenantId: string;
    reportType: string;
    recipients: string[];
    format: SsmReportDeliveryFormat;
  }) {
    const report = await this.overview.report(schedule.tenantId, schedule.reportType);
    const rowCount = Array.isArray(report?.rows) ? report.rows.length : 0;
    const subject = `Raport SSM programat: ${schedule.reportType}`;
    const text = `Raportul SSM „${schedule.reportType}” a fost generat automat.\nRânduri: ${rowCount}.\nDeschide platforma pentru export PDF/Excel.`;

    for (const to of schedule.recipients) {
      await this.mail.sendMail({ to, subject, text });
    }

    // Binary attachments are optional; email body notifies recipients. Full PDF attach can be added later.
    if (schedule.format === SsmReportDeliveryFormat.PDF || schedule.format === SsmReportDeliveryFormat.BOTH) {
      await this.overview.reportPdf(schedule.tenantId, schedule.reportType);
    }
    if (schedule.format === SsmReportDeliveryFormat.XLSX || schedule.format === SsmReportDeliveryFormat.BOTH) {
      await this.overview.reportExcel(schedule.tenantId, schedule.reportType);
    }
  }

  private assertInput(input: {
    reportType: string;
    cadence: SsmReportCadence;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    recipients: string[];
  }) {
    if (!input.reportType?.trim()) throw new BadRequestException("Tipul raportului este obligatoriu.");
    if (!input.recipients?.length) throw new BadRequestException("Cel puțin un destinatar este obligatoriu.");
    if (input.cadence === SsmReportCadence.WEEKLY) {
      if (input.dayOfWeek == null || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
        throw new BadRequestException("dayOfWeek trebuie să fie 0–6 pentru cadence WEEKLY.");
      }
    }
    if (input.cadence === SsmReportCadence.MONTHLY) {
      if (input.dayOfMonth == null || input.dayOfMonth < 1 || input.dayOfMonth > 28) {
        throw new BadRequestException("dayOfMonth trebuie să fie 1–28 pentru cadence MONTHLY.");
      }
    }
  }

  private computeNextRun(
    cadence: SsmReportCadence,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
    from = new Date()
  ): Date {
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setMinutes(0);
    next.setHours(7);

    if (cadence === SsmReportCadence.DAILY) {
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }

    if (cadence === SsmReportCadence.WEEKLY) {
      const target = dayOfWeek ?? 1;
      for (let i = 0; i < 8; i += 1) {
        const candidate = new Date(next);
        candidate.setDate(next.getDate() + i);
        if (candidate.getDay() === target && candidate > from) return candidate;
      }
      next.setDate(next.getDate() + 7);
      return next;
    }

    const targetDay = dayOfMonth ?? 1;
    next.setDate(targetDay);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDay);
    }
    return next;
  }
}
