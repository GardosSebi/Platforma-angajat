import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  SsmDocumentStatus,
  SsmEipMovementType,
  SsmMedicalControlResult,
  SsmPsiEquipmentStatus,
  SsmTrainingPlanStatus
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TYPES = ["trainings", "eip", "medical", "documents", "accidents", "psi", "compliance"] as const;

type ReportType = (typeof REPORT_TYPES)[number];
type TrafficLight = "GREEN" | "YELLOW" | "RED";
type ReportCell = string | number | boolean | null;
type ReportRow = Record<string, ReportCell>;

function daysDiff(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function normalizeReportType(type: string): ReportType {
  if ((REPORT_TYPES as readonly string[]).includes(type)) {
    return type as ReportType;
  }
  throw new BadRequestException(`Unsupported report type: ${type}`);
}

function formatCell(value: ReportCell): string {
  if (value === null) return "";
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function toExcelBuffer(rows: ReportRow[]): Buffer {
  const headers = rows[0] ? Object.keys(rows[0]) : ["message"];
  const lines = [
    headers.join("\t"),
    ...(rows.length ? rows : [{ message: "No rows" }]).map((row) => headers.map((header) => formatCell(row[header] ?? "")).join("\t"))
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

function pdfBuffer(title: string, rows: ReportRow[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown();
    doc.fontSize(9);
    const sample = rows.slice(0, 60);
    for (const row of sample) {
      doc.text(
        Object.entries(row)
          .map(([key, value]) => `${key}: ${formatCell(value)}`)
          .join(" | ")
      );
      doc.moveDown(0.35);
    }
    if (rows.length > sample.length) {
      doc.moveDown().text(`... ${rows.length - sample.length} rows omitted`);
    }
    doc.end();
  });
}

@Injectable()
export class SsmOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  private async worksiteIdsForLegalEntity(tenantId: string, legalEntityId?: string): Promise<string[] | null> {
    if (!legalEntityId) return null;
    const rows = await this.prisma.worksite.findMany({
      where: { tenantId, legalEntityId },
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }

  private employeeScopeWhere(worksiteIds: string[] | null): Prisma.EmployeeWhereInput | undefined {
    if (!worksiteIds) return undefined;
    if (!worksiteIds.length) {
      return { id: "__no_employee_in_legal_entity__" };
    }
    return { worksiteId: { in: worksiteIds } };
  }

  private worksiteScopeWhere(worksiteIds: string[] | null): Prisma.WorksiteWhereInput | undefined {
    if (!worksiteIds) return undefined;
    if (!worksiteIds.length) {
      return { id: "__no_worksite_in_legal_entity__" };
    }
    return { id: { in: worksiteIds } };
  }

  async unifiedCalendar(tenantId: string, legalEntityId?: string) {
    const worksiteIds = await this.worksiteIdsForLegalEntity(tenantId, legalEntityId);
    const employeeWhere = this.employeeScopeWhere(worksiteIds);
    const worksiteWhere = this.worksiteScopeWhere(worksiteIds);

    const trainingWhere: Prisma.SsmTrainingPlanWhereInput = {
      tenantId,
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const medicalWhere: Prisma.SsmMedicalControlWhereInput = {
      tenantId,
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const eipWhere: Prisma.SsmEipMovementWhereInput = {
      tenantId,
      movementType: SsmEipMovementType.DISTRIBUTION,
      replacementDueAt: { not: null },
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const psiEquipmentWhere: Prisma.SsmPsiEquipmentWhereInput = {
      tenantId,
      status: SsmPsiEquipmentStatus.ACTIVE,
      nextDueAt: { not: null },
      ...(worksiteWhere ? { worksite: worksiteWhere } : {})
    };
    const psiTrainingWhere: Prisma.SsmPsiTrainingRecordWhereInput = {
      tenantId,
      ...(worksiteWhere ? { worksite: worksiteWhere } : {})
    };
    const evacuationWhere: Prisma.SsmEvacuationDrillWhereInput = {
      tenantId,
      nextDueAt: { not: null },
      ...(worksiteWhere ? { worksite: worksiteWhere } : {})
    };

    const [trainingPlans, medicalControls, eipMovements, psiEquipment, psiTrainings, evacuationDrills] =
      await Promise.all([
      this.prisma.ssmTrainingPlan.findMany({
        where: trainingWhere,
        include: {
          employee: { select: { fullName: true } },
          trainingType: { select: { name: true } }
        },
        orderBy: { dueAt: "asc" },
        take: 200
      }),
      this.prisma.ssmMedicalControl.findMany({
        where: medicalWhere,
        include: {
          employee: { select: { fullName: true } },
          controlType: { select: { name: true } }
        },
        orderBy: [{ nextDueAt: "asc" }, { scheduledAt: "asc" }],
        take: 200
      }),
      this.prisma.ssmEipMovement.findMany({
        where: eipWhere,
        include: {
          employee: { select: { fullName: true } },
          eipType: { select: { name: true } }
        },
        orderBy: { replacementDueAt: "asc" },
        take: 200
      }),
      this.prisma.ssmPsiEquipment.findMany({
        where: psiEquipmentWhere,
        include: { worksite: { select: { name: true } } },
        orderBy: { nextDueAt: "asc" },
        take: 200
      }),
      this.prisma.ssmPsiTrainingRecord.findMany({
        where: psiTrainingWhere,
        include: {
          worksite: { select: { name: true } },
          employee: { select: { fullName: true } }
        },
        orderBy: [{ validUntil: "asc" }, { conductedAt: "desc" }],
        take: 200
      }),
      this.prisma.ssmEvacuationDrill.findMany({
        where: evacuationWhere,
        include: { worksite: { select: { name: true } } },
        orderBy: { nextDueAt: "asc" },
        take: 200
      })
    ]);

    const events = [
      ...trainingPlans.map((plan) => ({
        id: plan.id,
        source: "TRAINING",
        title: `${plan.trainingType.name} - ${plan.employee.fullName}`,
        startAt: plan.scheduledAt,
        dueAt: plan.dueAt,
        status: plan.status,
        ownerLabel: plan.employee.fullName
      })),
      ...medicalControls.map((control) => ({
        id: control.id,
        source: "MEDICAL",
        title: `${control.controlType.name} - ${control.employee.fullName}`,
        startAt: control.scheduledAt,
        dueAt: control.nextDueAt ?? control.scheduledAt,
        status: control.result ?? "PENDING",
        ownerLabel: control.employee.fullName
      })),
      ...eipMovements.map((movement) => ({
        id: movement.id,
        source: "EIP",
        title: `Înlocuire ${movement.eipType.name} - ${movement.employee.fullName}`,
        startAt: movement.movementDate,
        dueAt: movement.replacementDueAt,
        status: "REPLACEMENT_DUE",
        ownerLabel: movement.employee.fullName
      })),
      ...psiEquipment.map((equipment) => ({
        id: equipment.id,
        source: "PSI",
        title: `Verificare ${equipment.name} - ${equipment.worksite.name}`,
        startAt: equipment.lastVerifiedAt ?? equipment.createdAt,
        dueAt: equipment.nextDueAt,
        status: "VERIFICATION_DUE",
        ownerLabel: equipment.worksite.name
      })),
      ...psiTrainings.map((training) => ({
        id: training.id,
        source: "PSI_TRAINING",
        title: `${training.topic} - ${training.employee?.fullName ?? training.worksite.name}`,
        startAt: training.conductedAt,
        dueAt: training.validUntil ?? training.conductedAt,
        status: training.validUntil ? "VALID_UNTIL" : "RECORDED",
        ownerLabel: training.employee?.fullName ?? training.worksite.name
      })),
      ...evacuationDrills.map((drill) => ({
        id: drill.id,
        source: "EVACUATION_DRILL",
        title: `Simulare evacuare - ${drill.worksite.name}`,
        startAt: drill.conductedAt,
        dueAt: drill.nextDueAt ?? drill.conductedAt,
        status: "DRILL_DUE",
        ownerLabel: drill.worksite.name
      }))
    ].sort((a, b) => new Date(a.dueAt ?? a.startAt).getTime() - new Date(b.dueAt ?? b.startAt).getTime());

    return { events };
  }

  async calendarIcal(tenantId: string, legalEntityId?: string): Promise<string> {
    const { events } = await this.unifiedCalendar(tenantId, legalEntityId);
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

  async calendarPdf(tenantId: string, legalEntityId?: string): Promise<Buffer> {
    const { events } = await this.unifiedCalendar(tenantId, legalEntityId);
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

  async complianceDashboard(tenantId: string, legalEntityId?: string) {
    const now = new Date();
    const worksiteIds = await this.worksiteIdsForLegalEntity(tenantId, legalEntityId);
    const employeeWhere = this.employeeScopeWhere(worksiteIds);
    const worksiteWhere = this.worksiteScopeWhere(worksiteIds);

    const trainingWhere: Prisma.SsmTrainingPlanWhereInput = {
      tenantId,
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const medicalWhere: Prisma.SsmMedicalControlWhereInput = {
      tenantId,
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const eipWhere: Prisma.SsmEipMovementWhereInput = {
      tenantId,
      movementType: SsmEipMovementType.DISTRIBUTION,
      replacementDueAt: { not: null },
      ...(employeeWhere ? { employee: employeeWhere } : {})
    };
    const psiEquipmentWhere: Prisma.SsmPsiEquipmentWhereInput = {
      tenantId,
      status: SsmPsiEquipmentStatus.ACTIVE,
      ...(worksiteWhere ? { worksite: worksiteWhere } : {})
    };
    const documentWhere: Prisma.SsmDocumentWhereInput = {
      tenantId,
      ...(legalEntityId ? { legalEntityId } : {})
    };

    const [trainingPlans, medicalControls, eipMovements, psiEquipment, documents] = await Promise.all([
      this.prisma.ssmTrainingPlan.findMany({
        where: trainingWhere,
        include: {
          employee: { select: { fullName: true } },
          trainingType: { select: { name: true } }
        }
      }),
      this.prisma.ssmMedicalControl.findMany({
        where: medicalWhere,
        include: {
          employee: { select: { fullName: true } },
          controlType: { select: { name: true } }
        }
      }),
      this.prisma.ssmEipMovement.findMany({
        where: eipWhere,
        include: {
          employee: { select: { fullName: true } },
          eipType: { select: { name: true } }
        }
      }),
      this.prisma.ssmPsiEquipment.findMany({
        where: psiEquipmentWhere,
        include: { worksite: { select: { name: true } } }
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

    const total = breakdown.reduce((sum, item) => sum + item.total, 0);
    const noncompliant = breakdown.reduce((sum, item) => sum + item.noncompliant, 0);
    const globalScore = total ? Math.round(((total - noncompliant) / total) * 100) : 100;
    const trafficLight: TrafficLight = globalScore >= 90 ? "GREEN" : globalScore >= 75 ? "YELLOW" : "RED";
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
        severity: item.status
      })),
      ...medicalNoncompliant.map((item) => ({
        id: item.id,
        module: "Medicina muncii",
        title: item.controlType.name,
        subject: item.employee.fullName,
        dueAt: item.nextDueAt,
        daysOverdue: item.nextDueAt ? daysDiff(item.nextDueAt, now) : 0,
        severity: item.result ?? "OVERDUE"
      })),
      ...eipNoncompliant.map((item) => ({
        id: item.id,
        module: "EIP",
        title: item.eipType.name,
        subject: item.employee.fullName,
        dueAt: item.replacementDueAt,
        daysOverdue: item.replacementDueAt ? daysDiff(item.replacementDueAt, now) : 0,
        severity: "REPLACEMENT_OVERDUE"
      })),
      ...psiNoncompliant.map((item) => ({
        id: item.id,
        module: "PSI",
        title: item.name,
        subject: item.worksite.name,
        dueAt: item.nextDueAt,
        daysOverdue: item.nextDueAt ? daysDiff(item.nextDueAt, now) : 0,
        severity: "VERIFICATION_OVERDUE"
      })),
      ...documentNoncompliant.map((item) => ({
        id: item.id,
        module: "Documente",
        title: item.title,
        subject: item.targetLabel ?? item.targetType,
        dueAt: item.updatedAt,
        daysOverdue: 0,
        severity: item.status === SsmDocumentStatus.ARCHIVED ? "ARCHIVED" : "MISSING_ACTIVE_VERSION"
      }))
    ]
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 80);

    return {
      kpi: {
        globalScore,
        trafficLight,
        totalChecks: total,
        noncompliant
      },
      breakdown,
      topNonconformities,
      overdueItems
    };
  }

  async report(tenantId: string, type: string) {
    const reportType = normalizeReportType(type);
    return { type: reportType, generatedAt: new Date(), rows: await this.reportRows(tenantId, reportType) };
  }

  async reportPdf(tenantId: string, type: string) {
    const reportType = normalizeReportType(type);
    const rows = await this.reportRows(tenantId, reportType);
    return pdfBuffer(`Raport SSM - ${reportType}`, rows);
  }

  async reportExcel(tenantId: string, type: string) {
    const reportType = normalizeReportType(type);
    const rows = await this.reportRows(tenantId, reportType);
    return toExcelBuffer(rows);
  }

  private async reportRows(tenantId: string, type: ReportType): Promise<ReportRow[]> {
    if (type === "trainings") {
      const rows = await this.prisma.ssmTrainingPlan.findMany({
        where: { tenantId },
        include: {
          employee: { select: { fullName: true } },
          trainingType: { select: { code: true, name: true } }
        },
        orderBy: { dueAt: "asc" },
        take: 1000
      });
      return rows.map((row) => ({
        employee: row.employee.fullName,
        trainingCode: row.trainingType.code,
        trainingName: row.trainingType.name,
        status: row.status,
        scheduledAt: row.scheduledAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        score: row.score ?? null
      }));
    }
    if (type === "eip") {
      const rows = await this.prisma.ssmEipMovement.findMany({
        where: { tenantId },
        include: {
          employee: { select: { fullName: true } },
          eipType: { select: { code: true, name: true } }
        },
        orderBy: { movementDate: "desc" },
        take: 1000
      });
      return rows.map((row) => ({
        employee: row.employee.fullName,
        eipCode: row.eipType.code,
        eipName: row.eipType.name,
        movementType: row.movementType,
        quantity: row.quantity,
        movementDate: row.movementDate.toISOString(),
        replacementDueAt: row.replacementDueAt?.toISOString() ?? null,
        signedAt: row.signedAt?.toISOString() ?? null
      }));
    }
    if (type === "medical") {
      const rows = await this.prisma.ssmMedicalControl.findMany({
        where: { tenantId },
        include: {
          employee: { select: { fullName: true } },
          controlType: { select: { code: true, name: true } }
        },
        orderBy: [{ nextDueAt: "asc" }, { scheduledAt: "desc" }],
        take: 1000
      });
      return rows.map((row) => ({
        employee: row.employee.fullName,
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
        where: { tenantId },
        include: { employee: { select: { fullName: true } } },
        orderBy: { occurredAt: "desc" },
        take: 1000
      });
      return rows.map((row) => ({
        title: row.title,
        type: row.type,
        severity: row.severity,
        status: row.status,
        employee: row.employee?.fullName ?? null,
        occurredAt: row.occurredAt.toISOString(),
        location: row.location,
        itmDaysOff: row.itmDaysOff,
        isFatality: row.isFatality
      }));
    }
    if (type === "psi") {
      const equipment = await this.prisma.ssmPsiEquipment.findMany({
        where: { tenantId },
        include: { worksite: { select: { name: true } } },
        orderBy: { nextDueAt: "asc" },
        take: 500
      });
      const trainings = await this.prisma.ssmPsiTrainingRecord.findMany({
        where: { tenantId },
        include: {
          worksite: { select: { name: true } },
          employee: { select: { fullName: true } }
        },
        orderBy: { validUntil: "asc" },
        take: 500
      });
      return [
        ...equipment.map((row) => ({
          category: "EQUIPMENT",
          name: row.name,
          worksite: row.worksite.name,
          nextDueAt: row.nextDueAt?.toISOString() ?? null,
          status: row.status
        })),
        ...trainings.map((row) => ({
          category: "TRAINING",
          name: row.topic,
          worksite: row.worksite.name,
          employee: row.employee?.fullName ?? null,
          validUntil: row.validUntil?.toISOString() ?? null
        }))
      ];
    }
    if (type === "compliance") {
      const dashboard = await this.complianceDashboard(tenantId);
      return [
        {
          globalScore: dashboard.kpi.globalScore,
          trafficLight: dashboard.kpi.trafficLight,
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
      const rows = await this.prisma.ssmDocument.findMany({
        where: { tenantId },
        select: {
          title: true,
          type: true,
          status: true,
          targetType: true,
          targetLabel: true,
          legalEntityId: true,
          activeVersion: { select: { versionNumber: true } },
          versions: {
            orderBy: { versionNumber: "desc" },
            select: {
              versionNumber: true,
              fileName: true,
              changeNote: true,
              createdAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 1000
      });
      return rows.flatMap((row) =>
        row.versions.map((version) => ({
          title: row.title,
          type: row.type,
          status: row.status,
          targetType: row.targetType,
          targetLabel: row.targetLabel ?? null,
          legalEntityId: row.legalEntityId ?? null,
          activeVersionNumber: row.activeVersion?.versionNumber ?? null,
          versionNumber: version.versionNumber,
          fileName: version.fileName,
          changeNote: version.changeNote ?? null,
          versionCreatedAt: version.createdAt.toISOString()
        }))
      );
    }
    return [{ message: "No data" }];
  }
}
