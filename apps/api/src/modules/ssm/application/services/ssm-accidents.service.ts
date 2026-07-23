import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SsmAccidentCaseStatus,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  CloseAccidentCaseDto,
  CreateAccidentCaseDto,
  CreateAccidentCorrectiveMeasureDto,
  CreateAccidentTaskDto
} from "../../api/dto/ssm-accidents.dto";
import { SsmTrainingAutomationService } from "./ssm-training-automation.service";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return d;
}

function formatRoDate(value: Date | null | undefined): string {
  if (!value) return "-";
  return value.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

function typeLabelRo(type: SsmAccidentType): string {
  switch (type) {
    case SsmAccidentType.ACCIDENT:
      return "Accident de muncă";
    case SsmAccidentType.INCIDENT:
      return "Incident periculos (near-miss)";
    case SsmAccidentType.OCCUPATIONAL_DISEASE:
      return "Boală profesională";
    default:
      return type;
  }
}

@Injectable()
export class SsmAccidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trainingAutomation: SsmTrainingAutomationService
  ) {}

  async listCases(tenantId: string, query?: import("../../../../common/dto/pagination-query.dto").PaginationQueryDto) {
    const { resolvePagination } = await import("../../../../common/dto/pagination-query.dto");
    const { paginatedResult } = await import("../../../../common/pagination");
    const p = resolvePagination(query);
    const where = { tenantId };
    const [rows, total] = await Promise.all([
      this.prisma.ssmAccidentCase.findMany({
        where,
        include: {
          employee: { select: { fullName: true } },
          worksite: { select: { name: true, code: true } },
          department: { select: { name: true, code: true } },
          tasks: { orderBy: { dueAt: "asc" } },
          correctiveMeasureItems: { orderBy: { dueAt: "asc" } }
        },
        orderBy: [{ occurredAt: "desc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.ssmAccidentCase.count({ where })
    ]);
    const items = rows.map((row) => this.mapCase(row));
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  async createCase(tenantId: string, actorId: string, dto: CreateAccidentCaseDto) {
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, tenantId }
      });
      if (!employee) throw new NotFoundException("Employee not found for tenant.");
    }
    if (dto.worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({ where: { id: dto.worksiteId, tenantId } });
      if (!worksite) throw new NotFoundException("Worksite not found for tenant.");
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: dto.departmentId, tenantId } });
      if (!department) throw new NotFoundException("Department not found for tenant.");
    }

    if (dto.type === SsmAccidentType.OCCUPATIONAL_DISEASE && dto.diseaseConfirmed && !dto.diseaseConfirmedAt) {
      throw new BadRequestException("diseaseConfirmedAt is required when disease is confirmed.");
    }

    const occurredAt = parseDate(dto.occurredAt);
    const legalDaysDeadline = dto.legalDaysDeadline ?? 30;
    const dueAt = new Date(occurredAt.getTime() + legalDaysDeadline * 24 * 60 * 60 * 1000);

    const created = await this.prisma.ssmAccidentCase.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        worksiteId: dto.worksiteId,
        departmentId: dto.departmentId,
        type: dto.type,
        severity: dto.severity,
        title: dto.title.trim(),
        occurredAt,
        location: dto.location?.trim(),
        description: dto.description.trim(),
        witnesses: (dto.witnesses ?? []).map((w) => w.trim()).filter(Boolean),
        contributingFactors: dto.contributingFactors?.trim(),
        immediateMeasures: dto.immediateMeasures?.trim(),
        itmDaysOff: dto.itmDaysOff,
        hasPermanentDisability: dto.hasPermanentDisability ?? false,
        isFatality: dto.isFatality ?? false,
        diseaseConfirmed: dto.diseaseConfirmed ?? false,
        diseaseConfirmedAt: dto.diseaseConfirmedAt ? parseDate(dto.diseaseConfirmedAt) : undefined,
        diseaseConfirmedBy: dto.diseaseConfirmedBy?.trim(),
        diseaseDocumentRef: dto.diseaseDocumentRef?.trim(),
        researchResponsible: dto.researchResponsible?.trim(),
        legalDaysDeadline,
        dueAt,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_CASE_CREATED",
      entityType: "SsmAccidentCase",
      entityId: created.id,
      payload: { type: created.type, severity: created.severity }
    });
    return created;
  }

  async addTask(tenantId: string, actorId: string, dto: CreateAccidentTaskDto) {
    const accidentCase = await this.prisma.ssmAccidentCase.findFirst({
      where: { id: dto.accidentCaseId, tenantId }
    });
    if (!accidentCase) throw new NotFoundException("Accident case not found.");
    if (accidentCase.status === SsmAccidentCaseStatus.CLOSED) {
      throw new BadRequestException("Cannot add tasks to closed case.");
    }
    const task = await this.prisma.ssmAccidentTask.create({
      data: {
        tenantId,
        accidentCaseId: dto.accidentCaseId,
        title: dto.title.trim(),
        assignedTo: dto.assignedTo?.trim(),
        dueAt: parseDate(dto.dueAt),
        notes: dto.notes?.trim(),
        createdBy: actorId
      }
    });

    const nextStatus =
      accidentCase.status === SsmAccidentCaseStatus.OPEN || accidentCase.status === SsmAccidentCaseStatus.IN_RESEARCH
        ? SsmAccidentCaseStatus.IN_RESEARCH
        : accidentCase.status;

    await this.prisma.ssmAccidentCase.update({
      where: { id: accidentCase.id },
      data: {
        status: nextStatus,
        ...(dto.assignedTo?.trim() && !accidentCase.researchResponsible
          ? { researchResponsible: dto.assignedTo.trim() }
          : {})
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_TASK_ADDED",
      entityType: "SsmAccidentTask",
      entityId: task.id
    });
    return task;
  }

  async completeTask(tenantId: string, actorId: string, taskId: string) {
    const updated = await this.prisma.ssmAccidentTask.updateMany({
      where: { id: taskId, tenantId, completedAt: null },
      data: { completedAt: new Date() }
    });
    if (!updated.count) throw new NotFoundException("Open task not found.");
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_TASK_COMPLETED",
      entityType: "SsmAccidentTask",
      entityId: taskId
    });
    return { taskId, completed: true };
  }

  async addCorrectiveMeasure(tenantId: string, actorId: string, dto: CreateAccidentCorrectiveMeasureDto) {
    const accidentCase = await this.prisma.ssmAccidentCase.findFirst({
      where: { id: dto.accidentCaseId, tenantId }
    });
    if (!accidentCase) throw new NotFoundException("Accident case not found.");
    if (accidentCase.status === SsmAccidentCaseStatus.CLOSED) {
      throw new BadRequestException("Cannot add measures to closed case.");
    }

    const measure = await this.prisma.ssmAccidentCorrectiveMeasure.create({
      data: {
        tenantId,
        accidentCaseId: dto.accidentCaseId,
        description: dto.description.trim(),
        assignedTo: dto.assignedTo?.trim(),
        dueAt: parseDate(dto.dueAt),
        createdBy: actorId
      }
    });

    await this.prisma.ssmAccidentCase.update({
      where: { id: accidentCase.id },
      data: { status: SsmAccidentCaseStatus.MEASURES_DEFINED }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_CORRECTIVE_MEASURE_ADDED",
      entityType: "SsmAccidentCorrectiveMeasure",
      entityId: measure.id
    });
    return measure;
  }

  async completeCorrectiveMeasure(tenantId: string, actorId: string, measureId: string) {
    const updated = await this.prisma.ssmAccidentCorrectiveMeasure.updateMany({
      where: { id: measureId, tenantId, completedAt: null },
      data: { completedAt: new Date() }
    });
    if (!updated.count) throw new NotFoundException("Open corrective measure not found.");
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_CORRECTIVE_MEASURE_COMPLETED",
      entityType: "SsmAccidentCorrectiveMeasure",
      entityId: measureId
    });
    return { measureId, completed: true };
  }

  async closeCase(tenantId: string, actorId: string, caseId: string, dto: CloseAccidentCaseDto) {
    const accidentCase = await this.prisma.ssmAccidentCase.findFirst({
      where: { id: caseId, tenantId },
      include: { tasks: true, correctiveMeasureItems: true }
    });
    if (!accidentCase) throw new NotFoundException("Case not found.");
    const hasOpenTasks = accidentCase.tasks.some((task) => !task.completedAt);
    if (hasOpenTasks) throw new BadRequestException("Complete all research tasks before closing case.");

    const measuresSummary =
      dto.correctiveMeasures?.trim() ||
      accidentCase.correctiveMeasureItems.map((m) => `${m.description} (${m.assignedTo ?? "n/a"}, due ${m.dueAt.toISOString()})`).join("\n") ||
      undefined;

    if (!measuresSummary && accidentCase.correctiveMeasureItems.length === 0) {
      throw new BadRequestException("Add at least one corrective measure or provide correctiveMeasures text before closing.");
    }

    const updated = await this.prisma.ssmAccidentCase.update({
      where: { id: caseId },
      data: {
        status: SsmAccidentCaseStatus.CLOSED,
        conclusions: dto.conclusions.trim(),
        correctiveMeasures: measuresSummary,
        closedAt: new Date()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ACCIDENT_CASE_CLOSED",
      entityType: "SsmAccidentCase",
      entityId: caseId
    });
    if (accidentCase.employeeId && accidentCase.type === "ACCIDENT") {
      await this.trainingAutomation.assignOnAccidentClosed(tenantId, actorId, accidentCase.employeeId);
    }
    return updated;
  }

  async researchReportPdf(tenantId: string, caseId: string) {
    const accidentCase = await this.prisma.ssmAccidentCase.findFirst({
      where: { id: caseId, tenantId },
      include: {
        employee: {
          select: {
            fullName: true,
            email: true,
            cnp: true,
            jobPosition: { select: { name: true } },
            department: { select: { name: true } },
            worksite: { select: { name: true } }
          }
        },
        worksite: { select: { name: true, code: true, address: true } },
        department: { select: { name: true, code: true } },
        tasks: { orderBy: { dueAt: "asc" } },
        correctiveMeasureItems: { orderBy: { dueAt: "asc" } },
        tenant: { select: { name: true } }
      }
    });
    if (!accidentCase) throw new NotFoundException("Case not found.");

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const line = (label: string, value: string) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
      };
      const section = (title: string) => {
        doc.moveDown(0.6);
        doc.fontSize(13).font("Helvetica-Bold").text(title);
        doc.moveDown(0.2);
        doc.fontSize(11).font("Helvetica");
      };

      doc.fontSize(16).font("Helvetica-Bold").text("RAPORT DE CERCETARE", { align: "center" });
      doc.fontSize(12).text("Accident de muncă / Incident periculos / Boală profesională", { align: "center" });
      doc.fontSize(10).font("Helvetica").text("(conform cerințelor ITM – formular intern de cercetare)", { align: "center" });
      doc.moveDown();

      section("1. Date angajator");
      line("Denumire", accidentCase.tenant.name);
      line("Punct de lucru", accidentCase.worksite?.name ?? accidentCase.employee?.worksite?.name ?? accidentCase.location ?? "-");
      line("Adresă punct lucru", accidentCase.worksite?.address ?? "-");
      line("Departament", accidentCase.department?.name ?? accidentCase.employee?.department?.name ?? "-");

      section("2. Date victimă / persoană afectată");
      line("Nume și prenume", accidentCase.employee?.fullName ?? "-");
      line("CNP", accidentCase.employee?.cnp ?? "-");
      line("Email", accidentCase.employee?.email ?? "-");
      line("Funcție / post", accidentCase.employee?.jobPosition?.name ?? "-");

      section("3. Date eveniment");
      line("Tip eveniment", typeLabelRo(accidentCase.type));
      line("Severitate", accidentCase.severity);
      line("Status cercetare", accidentCase.status);
      line("Titlu caz", accidentCase.title);
      line("Data și ora", formatRoDate(accidentCase.occurredAt));
      line("Locul producerii", accidentCase.location ?? accidentCase.worksite?.name ?? "-");
      line("Responsabil cercetare", accidentCase.researchResponsible ?? "-");
      line("Termen legal cercetare", formatRoDate(accidentCase.dueAt));

      section("4. Descrierea evenimentului");
      doc.text(accidentCase.description || "-");

      section("5. Martori");
      doc.text(accidentCase.witnesses.length ? accidentCase.witnesses.join(", ") : "-");

      if (accidentCase.type === SsmAccidentType.INCIDENT) {
        section("6. Factori contribuitori (near-miss)");
        doc.text(accidentCase.contributingFactors ?? "-");
        section("7. Măsuri imediate");
        doc.text(accidentCase.immediateMeasures ?? "-");
      }

      if (accidentCase.type === SsmAccidentType.ACCIDENT) {
        section("6. Consecințe");
        line("Zile ITM / incapacitate temporară", accidentCase.itmDaysOff != null ? String(accidentCase.itmDaysOff) : "-");
        line("Invaliditate permanentă", accidentCase.hasPermanentDisability ? "Da" : "Nu");
        line("Deces", accidentCase.isFatality ? "Da" : "Nu");
      }

      if (accidentCase.type === SsmAccidentType.OCCUPATIONAL_DISEASE) {
        section("6. Confirmare boală profesională");
        line("Confirmată", accidentCase.diseaseConfirmed ? "Da" : "Nu");
        line("Data confirmării", formatRoDate(accidentCase.diseaseConfirmedAt));
        line("Autoritate / medic", accidentCase.diseaseConfirmedBy ?? "-");
        line("Document / referință", accidentCase.diseaseDocumentRef ?? "-");
      }

      section("8. Activități de cercetare");
      if (!accidentCase.tasks.length) {
        doc.text("-");
      } else {
        accidentCase.tasks.forEach((task, idx) => {
          doc.text(
            `${idx + 1}. ${task.title} | Responsabil: ${task.assignedTo ?? "-"} | Termen: ${formatRoDate(task.dueAt)} | ${
              task.completedAt ? `Finalizat ${formatRoDate(task.completedAt)}` : "În curs"
            }`
          );
          if (task.notes) doc.text(`   Note: ${task.notes}`);
        });
      }

      section("9. Concluzii");
      doc.text(accidentCase.conclusions ?? "-");

      section("10. Măsuri corective");
      if (accidentCase.correctiveMeasureItems.length) {
        accidentCase.correctiveMeasureItems.forEach((measure, idx) => {
          doc.text(
            `${idx + 1}. ${measure.description} | Responsabil: ${measure.assignedTo ?? "-"} | Termen: ${formatRoDate(measure.dueAt)} | ${
              measure.completedAt ? `Finalizat ${formatRoDate(measure.completedAt)}` : "Deschis"
            }`
          );
        });
      } else {
        doc.text(accidentCase.correctiveMeasures ?? "-");
      }

      doc.moveDown(1.2);
      doc.text(`Data generării: ${formatRoDate(new Date())}`);
      doc.moveDown(1.5);
      doc.text("Semnătura responsabilului cercetare: ________________________");
      doc.moveDown(0.8);
      doc.text("Semnătura angajatorului / reprezentant SSM: ________________________");

      doc.end();
    });
  }

  async stats(tenantId: string, period?: { from?: string; to?: string }) {
    const occurredAtFilter: Prisma.DateTimeFilter = {};
    if (period?.from) occurredAtFilter.gte = parseDate(period.from);
    if (period?.to) occurredAtFilter.lte = parseDate(period.to);
    const where: Prisma.SsmAccidentCaseWhereInput = {
      tenantId,
      ...(Object.keys(occurredAtFilter).length ? { occurredAt: occurredAtFilter } : {})
    };

    const [rows, tasksOverdue, measuresOverdue, activeEmployees] = await Promise.all([
      this.prisma.ssmAccidentCase.findMany({
        where,
        select: {
          type: true,
          severity: true,
          status: true,
          itmDaysOff: true,
          worksiteId: true,
          departmentId: true,
          worksite: { select: { name: true, code: true } },
          department: { select: { name: true, code: true } },
          employee: {
            select: {
              worksite: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } }
            }
          }
        }
      }),
      this.prisma.ssmAccidentTask.count({
        where: { tenantId, completedAt: null, dueAt: { lt: new Date() } }
      }),
      this.prisma.ssmAccidentCorrectiveMeasure.count({
        where: { tenantId, completedAt: null, dueAt: { lt: new Date() } }
      }),
      this.prisma.employee.count({ where: { tenantId, active: true } })
    ]);

    const byType: Record<SsmAccidentType, number> = {
      ACCIDENT: 0,
      INCIDENT: 0,
      OCCUPATIONAL_DISEASE: 0
    };
    const bySeverity: Record<SsmAccidentSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };
    const departmentMap = new Map<string, { key: string; label: string; count: number }>();
    const worksiteMap = new Map<string, { key: string; label: string; count: number }>();
    let openCases = 0;
    let accidentCount = 0;
    let totalItmDaysOff = 0;

    rows.forEach((row) => {
      byType[row.type] += 1;
      bySeverity[row.severity] += 1;
      if (row.status !== SsmAccidentCaseStatus.CLOSED) openCases += 1;
      if (row.type === SsmAccidentType.ACCIDENT) {
        accidentCount += 1;
        totalItmDaysOff += row.itmDaysOff ?? 0;
      }

      const deptId = row.departmentId ?? row.employee?.department?.id ?? "none";
      const deptLabel =
        row.department?.name ??
        row.employee?.department?.name ??
        (row.department?.code ? row.department.code : "Fără departament");
      const deptEntry = departmentMap.get(deptId) ?? { key: deptId, label: deptLabel, count: 0 };
      deptEntry.count += 1;
      departmentMap.set(deptId, deptEntry);

      const siteId = row.worksiteId ?? row.employee?.worksite?.id ?? "none";
      const siteLabel =
        row.worksite?.name ??
        row.employee?.worksite?.name ??
        (row.worksite?.code ? row.worksite.code : "Fără punct de lucru");
      const siteEntry = worksiteMap.get(siteId) ?? { key: siteId, label: siteLabel, count: 0 };
      siteEntry.count += 1;
      worksiteMap.set(siteId, siteEntry);
    });

    const frequencyRate = activeEmployees > 0 ? Number(((accidentCount * 1000) / activeEmployees).toFixed(2)) : null;
    const severityRate = accidentCount > 0 ? Number((totalItmDaysOff / accidentCount).toFixed(2)) : null;

    return {
      byType,
      bySeverity,
      byDepartment: Array.from(departmentMap.values()).sort((a, b) => b.count - a.count),
      byWorksite: Array.from(worksiteMap.values()).sort((a, b) => b.count - a.count),
      openCases,
      overdueTasks: tasksOverdue,
      overdueMeasures: measuresOverdue,
      totalCases: rows.length,
      accidentCount,
      totalItmDaysOff,
      activeEmployees,
      frequencyRate,
      severityRate,
      periodFrom: period?.from ?? null,
      periodTo: period?.to ?? null
    };
  }

  private mapCase(
    row: Prisma.SsmAccidentCaseGetPayload<{
      include: {
        employee: { select: { fullName: true } };
        worksite: { select: { name: true; code: true } };
        department: { select: { name: true; code: true } };
        tasks: true;
        correctiveMeasureItems: true;
      };
    }>
  ) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employee?.fullName,
      worksiteId: row.worksiteId,
      worksiteName: row.worksite?.name,
      departmentId: row.departmentId,
      departmentName: row.department?.name,
      type: row.type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      occurredAt: row.occurredAt,
      dueAt: row.dueAt,
      location: row.location,
      description: row.description,
      witnesses: row.witnesses,
      contributingFactors: row.contributingFactors,
      immediateMeasures: row.immediateMeasures,
      itmDaysOff: row.itmDaysOff,
      hasPermanentDisability: row.hasPermanentDisability,
      isFatality: row.isFatality,
      diseaseConfirmed: row.diseaseConfirmed,
      diseaseConfirmedAt: row.diseaseConfirmedAt,
      diseaseConfirmedBy: row.diseaseConfirmedBy,
      diseaseDocumentRef: row.diseaseDocumentRef,
      researchResponsible: row.researchResponsible,
      conclusions: row.conclusions,
      correctiveMeasures: row.correctiveMeasures,
      tasks: row.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        assignedTo: task.assignedTo,
        dueAt: task.dueAt,
        completedAt: task.completedAt,
        notes: task.notes
      })),
      correctiveMeasureItems: row.correctiveMeasureItems.map((measure) => ({
        id: measure.id,
        description: measure.description,
        assignedTo: measure.assignedTo,
        dueAt: measure.dueAt,
        completedAt: measure.completedAt
      }))
    };
  }
}
