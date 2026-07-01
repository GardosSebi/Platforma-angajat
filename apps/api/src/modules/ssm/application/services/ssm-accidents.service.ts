import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmAccidentCaseStatus,
  SsmAccidentSeverity,
  SsmAccidentType
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { CloseAccidentCaseDto, CreateAccidentCaseDto, CreateAccidentTaskDto } from "../../api/dto/ssm-accidents.dto";
import { SsmTrainingAutomationService } from "./ssm-training-automation.service";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return d;
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
          tasks: { orderBy: { dueAt: "asc" } }
        },
        orderBy: [{ occurredAt: "desc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.ssmAccidentCase.count({ where })
    ]);
    const items = rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee?.fullName,
        type: row.type,
        severity: row.severity,
        status: row.status,
        title: row.title,
        occurredAt: row.occurredAt,
        dueAt: row.dueAt,
        location: row.location,
        witnesses: row.witnesses,
        itmDaysOff: row.itmDaysOff,
        hasPermanentDisability: row.hasPermanentDisability,
        isFatality: row.isFatality,
        conclusions: row.conclusions,
        correctiveMeasures: row.correctiveMeasures,
        tasks: row.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          dueAt: task.dueAt,
          completedAt: task.completedAt,
          notes: task.notes
        }))
      }));
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  async createCase(tenantId: string, actorId: string, dto: CreateAccidentCaseDto) {
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, tenantId }
      });
      if (!employee) throw new NotFoundException("Employee not found for tenant.");
    }

    const occurredAt = parseDate(dto.occurredAt);
    const legalDaysDeadline = dto.legalDaysDeadline ?? 30;
    const dueAt = new Date(occurredAt.getTime() + legalDaysDeadline * 24 * 60 * 60 * 1000);

    const created = await this.prisma.ssmAccidentCase.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        type: dto.type,
        severity: dto.severity,
        title: dto.title.trim(),
        occurredAt,
        location: dto.location?.trim(),
        description: dto.description.trim(),
        witnesses: (dto.witnesses ?? []).map((w) => w.trim()).filter(Boolean),
        itmDaysOff: dto.itmDaysOff,
        hasPermanentDisability: dto.hasPermanentDisability ?? false,
        isFatality: dto.isFatality ?? false,
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
    await this.prisma.ssmAccidentCase.update({
      where: { id: accidentCase.id },
      data: { status: SsmAccidentCaseStatus.IN_RESEARCH }
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

  async closeCase(tenantId: string, actorId: string, caseId: string, dto: CloseAccidentCaseDto) {
    const accidentCase = await this.prisma.ssmAccidentCase.findFirst({
      where: { id: caseId, tenantId },
      include: { tasks: true }
    });
    if (!accidentCase) throw new NotFoundException("Case not found.");
    const hasOpenTasks = accidentCase.tasks.some((task) => !task.completedAt);
    if (hasOpenTasks) throw new BadRequestException("Complete all research tasks before closing case.");

    const updated = await this.prisma.ssmAccidentCase.update({
      where: { id: caseId },
      data: {
        status: SsmAccidentCaseStatus.CLOSED,
        conclusions: dto.conclusions.trim(),
        correctiveMeasures: dto.correctiveMeasures.trim(),
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
        employee: { select: { fullName: true, email: true } },
        tasks: { orderBy: { dueAt: "asc" } }
      }
    });
    if (!accidentCase) throw new NotFoundException("Case not found.");

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("Raport cercetare accident / incident / boala profesionala", { align: "center" });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Caz: ${accidentCase.title}`);
      doc.text(`Tip: ${accidentCase.type}`);
      doc.text(`Severitate: ${accidentCase.severity}`);
      doc.text(`Status: ${accidentCase.status}`);
      doc.text(`Data eveniment: ${accidentCase.occurredAt.toISOString()}`);
      doc.text(`Locatie: ${accidentCase.location ?? "-"}`);
      doc.text(`Martori: ${accidentCase.witnesses.length ? accidentCase.witnesses.join(", ") : "-"}`);
      doc.text(`Zile ITM: ${accidentCase.itmDaysOff ?? "-"}`);
      doc.text(`Invaliditate permanenta: ${accidentCase.hasPermanentDisability ? "Da" : "Nu"}`);
      doc.text(`Deces: ${accidentCase.isFatality ? "Da" : "Nu"}`);
      doc.text(`Angajat: ${accidentCase.employee?.fullName ?? "-"}`);
      doc.text(`Termen legal: ${accidentCase.dueAt.toISOString()}`);
      doc.moveDown().text("Descriere:");
      doc.text(accidentCase.description);
      doc.moveDown().text("Task-uri cercetare:");
      accidentCase.tasks.forEach((task, idx) => {
        doc.text(`${idx + 1}. ${task.title} | due ${task.dueAt.toISOString()} | ${task.completedAt ? "COMPLETED" : "OPEN"}`);
      });
      doc.moveDown().text("Concluzii:");
      doc.text(accidentCase.conclusions ?? "-");
      doc.moveDown().text("Masuri corective:");
      doc.text(accidentCase.correctiveMeasures ?? "-");
      doc.end();
    });
  }

  async stats(tenantId: string) {
    const rows = await this.prisma.ssmAccidentCase.findMany({
      where: { tenantId },
      select: { type: true, severity: true, status: true }
    });
    const tasksOverdue = await this.prisma.ssmAccidentTask.count({
      where: { tenantId, completedAt: null, dueAt: { lt: new Date() } }
    });

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
    let openCases = 0;
    rows.forEach((row) => {
      byType[row.type] += 1;
      bySeverity[row.severity] += 1;
      if (row.status !== SsmAccidentCaseStatus.CLOSED) openCases += 1;
    });

    return {
      byType,
      bySeverity,
      openCases,
      overdueTasks: tasksOverdue,
      totalCases: rows.length
    };
  }
}
