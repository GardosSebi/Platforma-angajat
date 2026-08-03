import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  SsmDocumentStatus,
  SsmEipMovementType,
  SsmMedicalControlResult,
  SsmPsiEquipmentStatus,
  SsmTrainingPlanStatus
} from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { applyUnicodeFonts, PdfFont } from "../../../../common/pdf-unicode-font";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { SsmEipService } from "./ssm-eip.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TYPES = [
  "trainings",
  "eip",
  "eip-stock",
  "medical",
  "documents",
  "accidents",
  "psi",
  "compliance"
] as const;
const CALENDAR_SOURCES = [
  "TRAINING",
  "MEDICAL",
  "EIP",
  "PSI",
  "PSI_TRAINING",
  "EVACUATION_DRILL"
] as const;

type ReportType = (typeof REPORT_TYPES)[number];
type TrafficLight = "GREEN" | "YELLOW" | "RED";
type CalendarSource = (typeof CALENDAR_SOURCES)[number];
type ReportCell = string | number | boolean | null;
type ReportRow = Record<string, ReportCell>;
type DocIssueFilter = "expired" | "needsReview" | undefined;

export type SsmOverviewQuery = {
  legalEntityId?: string;
  worksiteId?: string;
  departmentId?: string;
  employeeId?: string;
  source?: string;
  from?: string;
  to?: string;
  docIssue?: string;
};

type EmployeeScope = {
  employeeWhere?: Prisma.EmployeeWhereInput;
  worksiteWhere?: Prisma.WorksiteWhereInput;
  worksiteIds: string[] | null;
  legalEntityId?: string;
  worksiteId?: string;
  departmentId?: string;
  employeeId?: string;
};

type OrgBucket = {
  id: string;
  name: string;
  employeeIds: Set<string>;
  overdueEmployeeIds: Set<string>;
};

function daysDiff(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function trafficFromScore(score: number): TrafficLight {
  if (score >= 90) return "GREEN";
  if (score >= 75) return "YELLOW";
  return "RED";
}

function normalizeReportType(type: string): ReportType {
  if ((REPORT_TYPES as readonly string[]).includes(type)) {
    return type as ReportType;
  }
  throw new BadRequestException(`Unsupported report type: ${type}`);
}

function parseOptionalDate(value?: string, endOfDay = false): Date | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}

function normalizeSource(source?: string): CalendarSource | undefined {
  if (!source?.trim()) return undefined;
  const normalized = source.trim().toUpperCase();
  if (!(CALENDAR_SOURCES as readonly string[]).includes(normalized)) {
    throw new BadRequestException(`Unsupported calendar source: ${source}`);
  }
  return normalized as CalendarSource;
}

function formatCell(value: ReportCell): string {
  if (value === null) return "";
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

async function toExcelBuffer(rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Employee Platform SSM";
  const sheet = workbook.addWorksheet("Raport");
  const headers = rows[0] ? Object.keys(rows[0]) : ["message"];
  const dataRows = rows.length ? rows : [{ message: "No rows" }];
  sheet.addRow(headers);
  for (const row of dataRows) {
    sheet.addRow(headers.map((header) => formatCell(row[header] ?? "")));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((header) => ({
    header,
    width: Math.min(48, Math.max(header.length + 2, 14))
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function normalizeDocIssue(value?: string): DocIssueFilter {
  if (!value?.trim()) return undefined;
  const normalized = value.trim();
  if (normalized === "expired" || normalized === "needsReview") return normalized;
  throw new BadRequestException(`Unsupported docIssue filter: ${value}`);
}

function dateInRange(value: Date | null | undefined, from?: Date, to?: Date): boolean {
  if (!value) return !from && !to;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function pdfBuffer(title: string, rows: ReportRow[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    applyUnicodeFonts(doc);

    const dataRows = rows.length ? rows : [{ message: "No rows" }];
    const headers = Object.keys(dataRows[0] ?? { message: "" });
    const pageHeight = doc.page.height;
    const bottom = pageHeight - 48;

    const drawHeader = (pageIndex: number) => {
      doc.fontSize(14).font(PdfFont.bold).text(title, { underline: true });
      doc.moveDown(0.25);
      doc
        .fontSize(8)
        .font(PdfFont.regular)
        .fillColor("#475569")
        .text(`Pagina ${pageIndex} · ${dataRows.length} rânduri · generat ${new Date().toLocaleString("ro-RO")}`);
      doc.fillColor("#000000");
      doc.moveDown(0.5);
      doc.fontSize(8).font(PdfFont.bold).text(headers.join(" | "), { width: doc.page.width - 72 });
      doc.font(PdfFont.regular);
      doc.moveDown(0.35);
    };

    let pageIndex = 1;
    drawHeader(pageIndex);

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index]!;
      const line = `${index + 1}. ${headers.map((header) => formatCell(row[header] ?? "")).join(" | ")}`;
      const height = doc.heightOfString(line, { width: doc.page.width - 72 });
      if (doc.y + height > bottom) {
        doc.addPage();
        pageIndex += 1;
        drawHeader(pageIndex);
      }
      doc.fontSize(7.5).text(line, { width: doc.page.width - 72 });
      doc.moveDown(0.2);
    }

    doc.end();
  });
}

function eventInPeriod(
  event: { startAt: Date; dueAt: Date | null },
  from?: Date,
  to?: Date
): boolean {
  const anchor = event.dueAt ?? event.startAt;
  if (from && anchor < from) return false;
  if (to && anchor > to) return false;
  return true;
}

const employeeReportSelect = {
  id: true,
  fullName: true,
  department: { select: { name: true } },
  worksite: {
    select: {
      name: true,
      legalEntity: { select: { name: true } }
    }
  }
} as const;

@Injectable()
export class SsmOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eipService: SsmEipService
  ) {}

  private async resolveScope(tenantId: string, query: SsmOverviewQuery = {}): Promise<EmployeeScope> {
    let worksiteIds: string[] | null = null;

    if (query.legalEntityId) {
      const rows = await this.prisma.worksite.findMany({
        where: { tenantId, legalEntityId: query.legalEntityId },
        select: { id: true }
      });
      worksiteIds = rows.map((row) => row.id);
    }

    if (query.worksiteId) {
      if (worksiteIds && !worksiteIds.includes(query.worksiteId)) {
        worksiteIds = [];
      } else {
        worksiteIds = [query.worksiteId];
      }
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      tenantId,
      active: true,
      ...(query.employeeId ? { id: query.employeeId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(worksiteIds
        ? worksiteIds.length
          ? { worksiteId: { in: worksiteIds } }
          : { id: "__no_employee_in_scope__" }
        : {})
    };

    const worksiteWhere: Prisma.WorksiteWhereInput | undefined = worksiteIds
      ? worksiteIds.length
        ? { id: { in: worksiteIds } }
        : { id: "__no_worksite_in_scope__" }
      : undefined;

    return {
      employeeWhere,
      worksiteWhere,
      worksiteIds,
      legalEntityId: query.legalEntityId,
      worksiteId: query.worksiteId,
      departmentId: query.departmentId,
      employeeId: query.employeeId
    };
  }

  async unifiedCalendar(tenantId: string, query: SsmOverviewQuery = {}) {
    const scope = await this.resolveScope(tenantId, query);
    const sourceFilter = normalizeSource(query.source);
    const from = parseOptionalDate(query.from, false);
    const to = parseOptionalDate(query.to, true);
    const wants = (source: CalendarSource) => !sourceFilter || sourceFilter === source;
    const employeeLinkedOnly = Boolean(scope.employeeId || scope.departmentId);

    const trainingWhere: Prisma.SsmTrainingPlanWhereInput = {
      tenantId,
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const medicalWhere: Prisma.SsmMedicalControlWhereInput = {
      tenantId,
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const eipWhere: Prisma.SsmEipMovementWhereInput = {
      tenantId,
      movementType: SsmEipMovementType.DISTRIBUTION,
      replacementDueAt: { not: null },
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const psiEquipmentWhere: Prisma.SsmPsiEquipmentWhereInput = {
      tenantId,
      status: SsmPsiEquipmentStatus.ACTIVE,
      nextDueAt: { not: null },
      ...(scope.worksiteWhere ? { worksite: scope.worksiteWhere } : {})
    };
    const psiTrainingWhere: Prisma.SsmPsiTrainingRecordWhereInput = {
      tenantId,
      ...(scope.employeeId || scope.departmentId
        ? { employee: scope.employeeWhere }
        : scope.worksiteWhere
          ? { worksite: scope.worksiteWhere }
          : {})
    };
    const evacuationWhere: Prisma.SsmEvacuationDrillWhereInput = {
      tenantId,
      nextDueAt: { not: null },
      ...(scope.worksiteWhere ? { worksite: scope.worksiteWhere } : {})
    };

    const employeeInclude = {
      select: {
        id: true,
        fullName: true,
        departmentId: true,
        worksiteId: true,
        worksite: { select: { id: true, legalEntityId: true } }
      }
    } as const;

    const [
      trainingPlans,
      medicalControls,
      eipMovements,
      psiEquipment,
      psiTrainings,
      evacuationDrills
    ] = await Promise.all([
      wants("TRAINING")
        ? this.prisma.ssmTrainingPlan.findMany({
            where: trainingWhere,
            include: {
              employee: employeeInclude,
              trainingType: { select: { name: true } }
            },
            orderBy: { dueAt: "asc" },
            take: 500
          })
        : Promise.resolve([]),
      wants("MEDICAL")
        ? this.prisma.ssmMedicalControl.findMany({
            where: medicalWhere,
            include: {
              employee: employeeInclude,
              controlType: { select: { name: true } }
            },
            orderBy: [{ nextDueAt: "asc" }, { scheduledAt: "asc" }],
            take: 500
          })
        : Promise.resolve([]),
      wants("EIP")
        ? this.prisma.ssmEipMovement.findMany({
            where: eipWhere,
            include: {
              employee: employeeInclude,
              eipType: { select: { name: true } }
            },
            orderBy: { replacementDueAt: "asc" },
            take: 500
          })
        : Promise.resolve([]),
      wants("PSI") && !employeeLinkedOnly
        ? this.prisma.ssmPsiEquipment.findMany({
            where: psiEquipmentWhere,
            include: {
              worksite: { select: { id: true, name: true, legalEntityId: true } }
            },
            orderBy: { nextDueAt: "asc" },
            take: 500
          })
        : Promise.resolve([]),
      wants("PSI_TRAINING")
        ? this.prisma.ssmPsiTrainingRecord.findMany({
            where: psiTrainingWhere,
            include: {
              worksite: { select: { id: true, name: true, legalEntityId: true } },
              employee: employeeInclude
            },
            orderBy: [{ validUntil: "asc" }, { conductedAt: "desc" }],
            take: 500
          })
        : Promise.resolve([]),
      wants("EVACUATION_DRILL") && !employeeLinkedOnly
        ? this.prisma.ssmEvacuationDrill.findMany({
            where: evacuationWhere,
            include: {
              worksite: { select: { id: true, name: true, legalEntityId: true } }
            },
            orderBy: { nextDueAt: "asc" },
            take: 500
          })
        : Promise.resolve([])
    ]);

    const events = [
      ...trainingPlans.map((plan) => ({
        id: plan.id,
        source: "TRAINING" as const,
        title: `${plan.trainingType.name} - ${plan.employee.fullName}`,
        startAt: plan.scheduledAt,
        dueAt: plan.dueAt,
        status: plan.status,
        ownerLabel: plan.employee.fullName,
        employeeId: plan.employee.id,
        departmentId: plan.employee.departmentId,
        worksiteId: plan.employee.worksiteId,
        legalEntityId: plan.employee.worksite?.legalEntityId ?? null
      })),
      ...medicalControls.map((control) => ({
        id: control.id,
        source: "MEDICAL" as const,
        title: `${control.controlType.name} - ${control.employee.fullName}`,
        startAt: control.scheduledAt,
        dueAt: control.nextDueAt ?? control.scheduledAt,
        status: control.result ?? "PENDING",
        ownerLabel: control.employee.fullName,
        employeeId: control.employee.id,
        departmentId: control.employee.departmentId,
        worksiteId: control.employee.worksiteId,
        legalEntityId: control.employee.worksite?.legalEntityId ?? null
      })),
      ...eipMovements.map((movement) => ({
        id: movement.id,
        source: "EIP" as const,
        title: `Înlocuire ${movement.eipType.name} - ${movement.employee?.fullName ?? "—"}`,
        startAt: movement.movementDate,
        dueAt: movement.replacementDueAt,
        status: "REPLACEMENT_DUE",
        ownerLabel: movement.employee?.fullName ?? "—",
        employeeId: movement.employee?.id ?? null,
        departmentId: movement.employee?.departmentId ?? null,
        worksiteId: movement.employee?.worksiteId ?? null,
        legalEntityId: movement.employee?.worksite?.legalEntityId ?? null
      })),
      ...psiEquipment.map((equipment) => ({
        id: equipment.id,
        source: "PSI" as const,
        title: `Verificare ${equipment.name} - ${equipment.worksite.name}`,
        startAt: equipment.lastVerifiedAt ?? equipment.createdAt,
        dueAt: equipment.nextDueAt,
        status: "VERIFICATION_DUE",
        ownerLabel: equipment.worksite.name,
        employeeId: null as string | null,
        departmentId: null as string | null,
        worksiteId: equipment.worksite.id,
        legalEntityId: equipment.worksite.legalEntityId
      })),
      ...psiTrainings.map((training) => ({
        id: training.id,
        source: "PSI_TRAINING" as const,
        title: `${training.topic} - ${training.employee?.fullName ?? training.worksite.name}`,
        startAt: training.conductedAt,
        dueAt: training.validUntil ?? training.conductedAt,
        status: training.validUntil ? "VALID_UNTIL" : "RECORDED",
        ownerLabel: training.employee?.fullName ?? training.worksite.name,
        employeeId: training.employee?.id ?? null,
        departmentId: training.employee?.departmentId ?? null,
        worksiteId: training.worksite.id,
        legalEntityId: training.worksite.legalEntityId
      })),
      ...evacuationDrills.map((drill) => ({
        id: drill.id,
        source: "EVACUATION_DRILL" as const,
        title: `Simulare evacuare - ${drill.worksite.name}`,
        startAt: drill.conductedAt,
        dueAt: drill.nextDueAt ?? drill.conductedAt,
        status: "DRILL_DUE",
        ownerLabel: drill.worksite.name,
        employeeId: null as string | null,
        departmentId: null as string | null,
        worksiteId: drill.worksite.id,
        legalEntityId: drill.worksite.legalEntityId
      }))
    ]
      .filter((event) => eventInPeriod(event, from, to))
      .sort((a, b) => new Date(a.dueAt ?? a.startAt).getTime() - new Date(b.dueAt ?? b.startAt).getTime());

    return { events };
  }

  async calendarIcal(tenantId: string, query: SsmOverviewQuery = {}): Promise<string> {
    const { events } = await this.unifiedCalendar(tenantId, query);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Platforma Employee//SSM Calendar//RO",
      "CALSCALE:GREGORIAN"
    ];
    for (const event of events) {
      const uid = `${event.id}@ssm-platform`;
      const dtStart = new Date(event.startAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const dtEnd = new Date(event.dueAt ?? event.startAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${event.title.replace(/[,;\\]/g, " ")}`);
      lines.push(`DESCRIPTION:${event.source} / ${event.status}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  async calendarPdf(tenantId: string, query: SsmOverviewQuery = {}): Promise<Buffer> {
    const { events } = await this.unifiedCalendar(tenantId, query);
    const sourceLabels: Record<string, string> = {
      TRAINING: "Instruire",
      MEDICAL: "Medical",
      EIP: "EIP",
      PSI: "PSI",
      PSI_TRAINING: "Instruire PSI",
      EVACUATION_DRILL: "Simulare evacuare"
    };
    return pdfBuffer(
      "Calendar SSM unificat",
      events.map((event) => ({
        sursa: sourceLabels[event.source] ?? event.source,
        titlu: event.title,
        start: new Date(event.startAt).toLocaleDateString("ro-RO"),
        scadenta: new Date(event.dueAt ?? event.startAt).toLocaleDateString("ro-RO"),
        status: event.status,
        responsabil: event.ownerLabel
      }))
    );
  }

  async complianceDashboard(tenantId: string, query: SsmOverviewQuery = {}) {
    const now = new Date();
    const scope = await this.resolveScope(tenantId, query);

    const trainingWhere: Prisma.SsmTrainingPlanWhereInput = {
      tenantId,
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const medicalWhere: Prisma.SsmMedicalControlWhereInput = {
      tenantId,
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const eipWhere: Prisma.SsmEipMovementWhereInput = {
      tenantId,
      movementType: SsmEipMovementType.DISTRIBUTION,
      replacementDueAt: { not: null },
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const psiEquipmentWhere: Prisma.SsmPsiEquipmentWhereInput = {
      tenantId,
      status: SsmPsiEquipmentStatus.ACTIVE,
      ...(scope.worksiteWhere ? { worksite: scope.worksiteWhere } : {})
    };
    const psiTrainingWhere: Prisma.SsmPsiTrainingRecordWhereInput = {
      tenantId,
      employeeId: { not: null },
      ...(scope.employeeWhere ? { employee: scope.employeeWhere } : {})
    };
    const documentWhere: Prisma.SsmDocumentWhereInput = {
      tenantId,
      ...(scope.legalEntityId ? { legalEntityId: scope.legalEntityId } : {})
    };

    const employeeSelect = {
      id: true,
      fullName: true,
      email: true,
      departmentId: true,
      worksiteId: true,
      department: { select: { id: true, name: true } },
      worksite: {
        select: {
          id: true,
          name: true,
          legalEntityId: true,
          legalEntity: { select: { id: true, name: true } }
        }
      }
    } as const;

    const [employees, trainingPlans, medicalControls, eipMovements, psiEquipment, psiTrainings, documents] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: scope.employeeWhere ?? { tenantId, active: true },
          select: employeeSelect
        }),
        this.prisma.ssmTrainingPlan.findMany({
          where: trainingWhere,
          include: {
            employee: { select: employeeSelect },
            trainingType: { select: { name: true } }
          }
        }),
        this.prisma.ssmMedicalControl.findMany({
          where: medicalWhere,
          include: {
            employee: { select: employeeSelect },
            controlType: { select: { name: true } }
          }
        }),
        this.prisma.ssmEipMovement.findMany({
          where: eipWhere,
          include: {
            employee: { select: employeeSelect },
            eipType: { select: { name: true } }
          }
        }),
        this.prisma.ssmPsiEquipment.findMany({
          where: psiEquipmentWhere,
          include: { worksite: { select: { name: true } } }
        }),
        this.prisma.ssmPsiTrainingRecord.findMany({
          where: psiTrainingWhere,
          include: {
            employee: { select: employeeSelect },
            worksite: { select: { name: true } }
          }
        }),
        this.prisma.ssmDocument.findMany({
          where: documentWhere,
          include: { activeVersion: true }
        })
      ]);

    const trainingNoncompliant = trainingPlans.filter(
      (item) => item.status === SsmTrainingPlanStatus.OVERDUE || item.status === SsmTrainingPlanStatus.BLOCKED
    );
    const medicalNoncompliant = medicalControls.filter(
      (item) =>
        (item.nextDueAt && item.nextDueAt < now) ||
        item.result === SsmMedicalControlResult.UNFIT ||
        item.result === SsmMedicalControlResult.TEMPORARY_UNFIT
    );
    const eipNoncompliant = eipMovements.filter((item) => item.replacementDueAt && item.replacementDueAt < now);
    const psiNoncompliant = psiEquipment.filter((item) => item.nextDueAt && item.nextDueAt < now);
    const psiTrainingNoncompliant = psiTrainings.filter(
      (item) => item.validUntil != null && item.validUntil < now
    );
    const documentNoncompliant = documents.filter(
      (item) => item.status === SsmDocumentStatus.ARCHIVED || !item.activeVersion
    );

    const breakdown = [
      { module: "Instruiri", total: trainingPlans.length, noncompliant: trainingNoncompliant.length },
      { module: "Medicina muncii", total: medicalControls.length, noncompliant: medicalNoncompliant.length },
      { module: "EIP", total: eipMovements.length, noncompliant: eipNoncompliant.length },
      { module: "PSI", total: psiEquipment.length, noncompliant: psiNoncompliant.length },
      { module: "Documente", total: documents.length, noncompliant: documentNoncompliant.length }
    ].map((item) => ({
      ...item,
      compliant: Math.max(item.total - item.noncompliant, 0),
      score: item.total ? Math.round(((item.total - item.noncompliant) / item.total) * 100) : 100
    }));

    const totalChecks = breakdown.reduce((sum, item) => sum + item.total, 0);
    const noncompliantChecks = breakdown.reduce((sum, item) => sum + item.noncompliant, 0);
    const checksScore = totalChecks
      ? Math.round(((totalChecks - noncompliantChecks) / totalChecks) * 100)
      : 100;

    type Outstanding = {
      id: string;
      module: string;
      title: string;
      dueAt: Date | null;
      daysOverdue: number;
      severity: string;
      employeeId: string;
    };

    const outstandingByEmployee = new Map<string, Outstanding[]>();
    const pushOutstanding = (item: Outstanding) => {
      const list = outstandingByEmployee.get(item.employeeId) ?? [];
      list.push(item);
      outstandingByEmployee.set(item.employeeId, list);
    };

    for (const item of trainingNoncompliant) {
      pushOutstanding({
        id: item.id,
        module: "Instruiri",
        title: item.trainingType.name,
        dueAt: item.dueAt,
        daysOverdue: daysDiff(item.dueAt, now),
        severity: item.status,
        employeeId: item.employeeId
      });
    }
    for (const item of medicalNoncompliant) {
      pushOutstanding({
        id: item.id,
        module: "Medicina muncii",
        title: item.controlType.name,
        dueAt: item.nextDueAt,
        daysOverdue: item.nextDueAt ? daysDiff(item.nextDueAt, now) : 0,
        severity: item.result ?? "OVERDUE",
        employeeId: item.employeeId
      });
    }
    for (const item of eipNoncompliant) {
      if (!item.employeeId) continue;
      pushOutstanding({
        id: item.id,
        module: "EIP",
        title: item.eipType.name,
        dueAt: item.replacementDueAt,
        daysOverdue: item.replacementDueAt ? daysDiff(item.replacementDueAt, now) : 0,
        severity: "REPLACEMENT_OVERDUE",
        employeeId: item.employeeId
      });
    }
    for (const item of psiTrainingNoncompliant) {
      if (!item.employeeId) continue;
      pushOutstanding({
        id: item.id,
        module: "PSI",
        title: item.topic,
        dueAt: item.validUntil,
        daysOverdue: item.validUntil ? daysDiff(item.validUntil, now) : 0,
        severity: "PSI_TRAINING_OVERDUE",
        employeeId: item.employeeId
      });
    }

    const totalEmployees = employees.length;
    const overdueEmployeeIds = new Set(outstandingByEmployee.keys());
    const compliantEmployees = employees.filter((emp) => !overdueEmployeeIds.has(emp.id)).length;
    const overdueEmployeesCount = totalEmployees - compliantEmployees;
    const globalScore = totalEmployees ? Math.round((compliantEmployees / totalEmployees) * 100) : 100;
    const trafficLight = trafficFromScore(globalScore);

    const topNonconformities = breakdown
      .filter((item) => item.noncompliant > 0)
      .sort((a, b) => b.noncompliant - a.noncompliant)
      .slice(0, 5)
      .map((item) => ({ module: item.module, count: item.noncompliant, score: item.score }));

    const overdueItems = [
      ...trainingNoncompliant.map((item) => ({
        id: item.id,
        module: "Instruiri",
        title: item.trainingType.name,
        subject: item.employee.fullName,
        dueAt: item.dueAt,
        daysOverdue: daysDiff(item.dueAt, now),
        severity: item.status,
        employeeId: item.employeeId
      })),
      ...medicalNoncompliant.map((item) => ({
        id: item.id,
        module: "Medicina muncii",
        title: item.controlType.name,
        subject: item.employee.fullName,
        dueAt: item.nextDueAt,
        daysOverdue: item.nextDueAt ? daysDiff(item.nextDueAt, now) : 0,
        severity: item.result ?? "OVERDUE",
        employeeId: item.employeeId
      })),
      ...eipNoncompliant.map((item) => ({
        id: item.id,
        module: "EIP",
        title: item.eipType.name,
        subject: item.employee?.fullName ?? "—",
        dueAt: item.replacementDueAt,
        daysOverdue: item.replacementDueAt ? daysDiff(item.replacementDueAt, now) : 0,
        severity: "REPLACEMENT_OVERDUE",
        employeeId: item.employeeId
      })),
      ...psiNoncompliant.map((item) => ({
        id: item.id,
        module: "PSI",
        title: item.name,
        subject: item.worksite.name,
        dueAt: item.nextDueAt,
        daysOverdue: item.nextDueAt ? daysDiff(item.nextDueAt, now) : 0,
        severity: "VERIFICATION_OVERDUE",
        employeeId: null as string | null
      })),
      ...documentNoncompliant.map((item) => ({
        id: item.id,
        module: "Documente",
        title: item.title,
        subject: item.targetLabel ?? item.targetType,
        dueAt: item.updatedAt,
        daysOverdue: 0,
        severity: item.status === SsmDocumentStatus.ARCHIVED ? "ARCHIVED" : "MISSING_ACTIVE_VERSION",
        employeeId: null as string | null
      }))
    ]
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 80);

    const employeeById = new Map(employees.map((emp) => [emp.id, emp]));
    const overdueEmployees = [...outstandingByEmployee.entries()]
      .map(([employeeId, items]) => {
        const emp = employeeById.get(employeeId);
        const modules = [...new Set(items.map((item) => item.module))];
        return {
          employeeId,
          fullName: emp?.fullName ?? items[0]?.title ?? "—",
          email: emp?.email ?? null,
          departmentId: emp?.departmentId ?? null,
          departmentName: emp?.department?.name ?? null,
          worksiteId: emp?.worksiteId ?? null,
          worksiteName: emp?.worksite?.name ?? null,
          legalEntityId: emp?.worksite?.legalEntityId ?? null,
          legalEntityName: emp?.worksite?.legalEntity?.name ?? null,
          outstandingCount: items.length,
          modules,
          maxDaysOverdue: Math.max(...items.map((item) => item.daysOverdue), 0),
          items: items
            .sort((a, b) => b.daysOverdue - a.daysOverdue)
            .map((item) => ({
              id: item.id,
              module: item.module,
              title: item.title,
              dueAt: item.dueAt,
              daysOverdue: item.daysOverdue,
              severity: item.severity
            }))
        };
      })
      .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || b.outstandingCount - a.outstandingCount)
      .slice(0, 100);

    const entityBuckets = new Map<string, OrgBucket>();
    const departmentBuckets = new Map<string, OrgBucket>();
    for (const emp of employees) {
      const entityId = emp.worksite?.legalEntityId;
      const entityName = emp.worksite?.legalEntity?.name;
      if (entityId && entityName) {
        const bucket = entityBuckets.get(entityId) ?? {
          id: entityId,
          name: entityName,
          employeeIds: new Set<string>(),
          overdueEmployeeIds: new Set<string>()
        };
        bucket.employeeIds.add(emp.id);
        if (overdueEmployeeIds.has(emp.id)) bucket.overdueEmployeeIds.add(emp.id);
        entityBuckets.set(entityId, bucket);
      }

      if (emp.departmentId && emp.department?.name) {
        const bucket = departmentBuckets.get(emp.departmentId) ?? {
          id: emp.departmentId,
          name: emp.department.name,
          employeeIds: new Set<string>(),
          overdueEmployeeIds: new Set<string>()
        };
        bucket.employeeIds.add(emp.id);
        if (overdueEmployeeIds.has(emp.id)) bucket.overdueEmployeeIds.add(emp.id);
        departmentBuckets.set(emp.departmentId, bucket);
      }
    }

    const toTrafficItems = (buckets: Map<string, OrgBucket>) =>
      [...buckets.values()]
        .map((bucket) => {
          const employeeCount = bucket.employeeIds.size;
          const overdue = bucket.overdueEmployeeIds.size;
          const compliant = employeeCount - overdue;
          const score = employeeCount ? Math.round((compliant / employeeCount) * 100) : 100;
          return {
            id: bucket.id,
            name: bucket.name,
            score,
            trafficLight: trafficFromScore(score),
            employeeCount,
            compliantEmployees: compliant,
            overdueEmployees: overdue
          };
        })
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

    return {
      kpi: {
        globalScore,
        trafficLight,
        totalEmployees,
        compliantEmployees,
        overdueEmployees: overdueEmployeesCount,
        checksScore,
        totalChecks,
        noncompliant: noncompliantChecks
      },
      breakdown,
      topNonconformities,
      overdueItems,
      overdueEmployees,
      byEntity: toTrafficItems(entityBuckets),
      byDepartment: toTrafficItems(departmentBuckets)
    };
  }

  async report(tenantId: string, type: string, query: SsmOverviewQuery = {}) {
    const reportType = normalizeReportType(type);
    return {
      type: reportType,
      generatedAt: new Date(),
      rows: await this.reportRows(tenantId, reportType, query)
    };
  }

  async reportPdf(tenantId: string, type: string, query: SsmOverviewQuery = {}) {
    const reportType = normalizeReportType(type);
    const rows = await this.reportRows(tenantId, reportType, query);
    return pdfBuffer(`Raport SSM - ${reportType}`, rows);
  }

  async reportExcel(tenantId: string, type: string, query: SsmOverviewQuery = {}) {
    const reportType = normalizeReportType(type);
    const rows = await this.reportRows(tenantId, reportType, query);
    return await toExcelBuffer(rows);
  }

  private async reportRows(
    tenantId: string,
    type: ReportType,
    query: SsmOverviewQuery = {}
  ): Promise<ReportRow[]> {
    const scope = await this.resolveScope(tenantId, query);
    const from = parseOptionalDate(query.from, false);
    const to = parseOptionalDate(query.to, true);
    const docIssue = normalizeDocIssue(query.docIssue);
    const employeeWhere = scope.employeeWhere;
    const worksiteWhere = scope.worksiteWhere;

    if (type === "trainings") {
      const rows = await this.prisma.ssmTrainingPlan.findMany({
        where: {
          tenantId,
          ...(employeeWhere ? { employee: employeeWhere } : {}),
          ...(from || to
            ? {
                OR: [
                  { dueAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                  { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                  { completedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
                ]
              }
            : {})
        },
        include: {
          employee: { select: employeeReportSelect },
          trainingType: { select: { code: true, name: true } }
        },
        orderBy: { dueAt: "asc" },
        take: 5000
      });
      return rows.map((row) => ({
        employee: row.employee.fullName,
        department: row.employee.department?.name ?? null,
        worksite: row.employee.worksite?.name ?? null,
        legalEntity: row.employee.worksite?.legalEntity?.name ?? null,
        trainingCode: row.trainingType.code,
        trainingName: row.trainingType.name,
        status: row.status,
        result: row.score != null ? `${row.status} · scor ${row.score}` : row.status,
        scheduledAt: row.scheduledAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        score: row.score ?? null
      }));
    }

    if (type === "eip") {
      const rows = await this.prisma.ssmEipMovement.findMany({
        where: {
          tenantId,
          ...(employeeWhere
            ? {
                OR: [{ employee: employeeWhere }, { employeeId: null }]
              }
            : {}),
          ...(from || to
            ? {
                movementDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {})
                }
              }
            : {})
        },
        include: {
          employee: { select: employeeReportSelect },
          eipType: { select: { code: true, name: true } },
          worksite: { select: { name: true, legalEntity: { select: { name: true } } } },
          department: { select: { name: true } }
        },
        orderBy: { movementDate: "desc" },
        take: 5000
      });
      return rows
        .filter((row) => {
          if (!employeeWhere) return true;
          if (row.employeeId) return true;
          if (scope.departmentId && row.departmentId !== scope.departmentId) return false;
          if (scope.worksiteIds && row.worksiteId && !scope.worksiteIds.includes(row.worksiteId)) {
            return false;
          }
          return true;
        })
        .map((row) => ({
          employee: row.employee?.fullName ?? "—",
          department: row.employee?.department?.name ?? row.department?.name ?? null,
          worksite: row.employee?.worksite?.name ?? row.worksite?.name ?? null,
          legalEntity:
            row.employee?.worksite?.legalEntity?.name ?? row.worksite?.legalEntity?.name ?? null,
          eipCode: row.eipType.code,
          eipName: row.eipType.name,
          movementType: row.movementType,
          quantity: row.quantity,
          movementDate: row.movementDate.toISOString(),
          replacementDueAt: row.replacementDueAt?.toISOString() ?? null,
          signedAt: row.signedAt?.toISOString() ?? null
        }));
    }

    if (type === "eip-stock") {
      const stock = await this.eipService.stockGapReport(tenantId);
      return stock.items
        .filter((item) => {
          if (scope.departmentId && item.departmentId !== scope.departmentId) return false;
          if (scope.worksiteId && item.worksiteId !== scope.worksiteId) return false;
          if (scope.worksiteIds && item.worksiteId && !scope.worksiteIds.includes(item.worksiteId)) {
            return false;
          }
          return true;
        })
        .map((item) => ({
          eipType: item.eipTypeName,
          worksite: item.worksiteName,
          department: item.departmentName,
          required: item.required,
          distributedActive: item.distributedActive,
          stockOnHand: item.stockOnHand,
          shortage: item.shortage
        }));
    }

    if (type === "medical") {
      const rows = await this.prisma.ssmMedicalControl.findMany({
        where: {
          tenantId,
          ...(employeeWhere ? { employee: employeeWhere } : {}),
          ...(from || to
            ? {
                OR: [
                  { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                  { performedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                  { nextDueAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
                ]
              }
            : {})
        },
        include: {
          employee: { select: employeeReportSelect },
          controlType: { select: { code: true, name: true } }
        },
        orderBy: [{ nextDueAt: "asc" }, { scheduledAt: "desc" }],
        take: 5000
      });
      return rows.map((row) => ({
        employee: row.employee.fullName,
        department: row.employee.department?.name ?? null,
        worksite: row.employee.worksite?.name ?? null,
        legalEntity: row.employee.worksite?.legalEntity?.name ?? null,
        controlCode: row.controlType.code,
        controlName: row.controlType.name,
        scheduledAt: row.scheduledAt.toISOString(),
        performedAt: row.performedAt?.toISOString() ?? null,
        result: row.result ?? null,
        validityUntil: row.validityUntil?.toISOString() ?? null,
        nextDueAt: row.nextDueAt?.toISOString() ?? null
      }));
    }

    if (type === "accidents") {
      const rows = await this.prisma.ssmAccidentCase.findMany({
        where: {
          tenantId,
          ...(employeeWhere ? { employee: employeeWhere } : {}),
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          ...(worksiteWhere ? { worksite: worksiteWhere } : {}),
          ...(from || to
            ? {
                occurredAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {})
                }
              }
            : {})
        },
        include: {
          employee: { select: { fullName: true } },
          worksite: { select: { name: true, legalEntity: { select: { name: true } } } },
          department: { select: { name: true } }
        },
        orderBy: { occurredAt: "desc" },
        take: 5000
      });
      return rows.map((row) => ({
        title: row.title,
        type: row.type,
        severity: row.severity,
        status: row.status,
        employee: row.employee?.fullName ?? null,
        occurredAt: row.occurredAt.toISOString(),
        location: row.location,
        worksite: row.worksite?.name ?? null,
        department: row.department?.name ?? null,
        legalEntity: row.worksite?.legalEntity?.name ?? null,
        itmDaysOff: row.itmDaysOff,
        isFatality: row.isFatality,
        diseaseConfirmed: row.diseaseConfirmed
      }));
    }

    if (type === "psi") {
      const equipment = await this.prisma.ssmPsiEquipment.findMany({
        where: {
          tenantId,
          ...(worksiteWhere ? { worksite: worksiteWhere } : {}),
          ...(from || to
            ? {
                nextDueAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {})
                }
              }
            : {})
        },
        include: {
          worksite: { select: { name: true, legalEntity: { select: { name: true } } } }
        },
        orderBy: { nextDueAt: "asc" },
        take: 2500
      });
      const trainings = await this.prisma.ssmPsiTrainingRecord.findMany({
        where: {
          tenantId,
          ...(employeeWhere
            ? { OR: [{ employee: employeeWhere }, { employeeId: null, ...(worksiteWhere ? { worksite: worksiteWhere } : {}) }] }
            : worksiteWhere
              ? { worksite: worksiteWhere }
              : {}),
          ...(from || to
            ? {
                OR: [
                  { conductedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                  { validUntil: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
                ]
              }
            : {})
        },
        include: {
          worksite: { select: { name: true, legalEntity: { select: { name: true } } } },
          employee: { select: { fullName: true } }
        },
        orderBy: { validUntil: "asc" },
        take: 2500
      });
      return [
        ...equipment.map((row) => ({
          category: "EQUIPMENT",
          name: row.name,
          worksite: row.worksite.name,
          legalEntity: row.worksite.legalEntity?.name ?? null,
          nextDueAt: row.nextDueAt?.toISOString() ?? null,
          status: row.status
        })),
        ...trainings.map((row) => ({
          category: "TRAINING",
          name: row.topic,
          worksite: row.worksite.name,
          legalEntity: row.worksite.legalEntity?.name ?? null,
          employee: row.employee?.fullName ?? null,
          validUntil: row.validUntil?.toISOString() ?? null
        }))
      ];
    }

    if (type === "compliance") {
      const dashboard = await this.complianceDashboard(tenantId, query);
      return [
        {
          globalScore: dashboard.kpi.globalScore,
          trafficLight: dashboard.kpi.trafficLight,
          totalEmployees: dashboard.kpi.totalEmployees,
          compliantEmployees: dashboard.kpi.compliantEmployees,
          overdueEmployees: dashboard.kpi.overdueEmployees,
          checksScore: dashboard.kpi.checksScore,
          totalChecks: dashboard.kpi.totalChecks,
          noncompliant: dashboard.kpi.noncompliant
        },
        ...dashboard.breakdown.map((item) => ({
          module: item.module,
          total: item.total,
          compliant: item.compliant,
          noncompliant: item.noncompliant,
          score: item.score
        }))
      ];
    }

    if (type === "documents") {
      const now = new Date();
      const rows = await this.prisma.ssmDocument.findMany({
        where: {
          tenantId,
          ...(scope.legalEntityId ? { legalEntityId: scope.legalEntityId } : {})
        },
        select: {
          title: true,
          type: true,
          status: true,
          targetType: true,
          targetLabel: true,
          departmentName: true,
          periodStart: true,
          periodEnd: true,
          legalEntityId: true,
          legalEntity: { select: { name: true } },
          activeVersion: {
            select: { versionNumber: true, fileName: true, changeNote: true, createdAt: true }
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true, createdAt: true },
            take: 1
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 5000
      });

      return rows
        .map((row) => {
          const isExpired = Boolean(row.periodEnd && row.periodEnd < now);
          const needsReview =
            !row.activeVersion || row.status === SsmDocumentStatus.ARCHIVED || isExpired;
          const latest = row.activeVersion ?? row.versions[0] ?? null;
          return {
            title: row.title,
            type: row.type,
            status: row.status,
            targetType: row.targetType,
            targetLabel: row.targetLabel ?? null,
            department: row.departmentName ?? null,
            legalEntity: row.legalEntity?.name ?? null,
            periodStart: row.periodStart?.toISOString() ?? null,
            periodEnd: row.periodEnd?.toISOString() ?? null,
            activeVersionNumber: row.activeVersion?.versionNumber ?? null,
            versionCountHint: latest?.versionNumber ?? 0,
            latestVersionAt: latest?.createdAt?.toISOString() ?? null,
            fileName: row.activeVersion?.fileName ?? null,
            changeNote: row.activeVersion?.changeNote ?? null,
            isExpired,
            needsReview
          };
        })
        .filter((row) => {
          if (docIssue === "expired" && !row.isExpired) return false;
          if (docIssue === "needsReview" && !row.needsReview) return false;
          if (from || to) {
            const anchor = row.periodEnd
              ? new Date(row.periodEnd)
              : row.latestVersionAt
                ? new Date(row.latestVersionAt)
                : null;
            if (!dateInRange(anchor, from, to)) return false;
          }
          return true;
        });
    }

    return [{ message: "No data" }];
  }
}
