import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SsmRiskAssessmentStatus, SsmRiskTargetType } from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  AddSsmRiskAssessmentVersionDto,
  CreateSsmRiskAssessmentDto,
  ListSsmRiskAssessmentsDto
} from "../../api/dto/ssm-risk.dto";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

@Injectable()
export class SsmRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private async validateTarget(tenantId: string, dto: CreateSsmRiskAssessmentDto) {
    if (dto.targetType === SsmRiskTargetType.JOB_POSITION) {
      if (!dto.jobPositionId) throw new BadRequestException("jobPositionId is required.");
      const job = await this.prisma.jobPosition.findFirst({ where: { id: dto.jobPositionId, tenantId } });
      if (!job) throw new NotFoundException("Job position not found for tenant.");
      return { jobPositionId: dto.jobPositionId, worksiteId: null, departmentId: null };
    }
    if (dto.targetType === SsmRiskTargetType.WORKSITE) {
      if (!dto.worksiteId) throw new BadRequestException("worksiteId is required.");
      const worksite = await this.prisma.worksite.findFirst({ where: { id: dto.worksiteId, tenantId } });
      if (!worksite) throw new NotFoundException("Worksite not found for tenant.");
      return { jobPositionId: null, worksiteId: dto.worksiteId, departmentId: null };
    }
    if (!dto.departmentId) throw new BadRequestException("departmentId is required.");
    const department = await this.prisma.department.findFirst({ where: { id: dto.departmentId, tenantId } });
    if (!department) throw new NotFoundException("Department not found for tenant.");
    return { jobPositionId: null, worksiteId: null, departmentId: dto.departmentId };
  }

  async createAssessment(tenantId: string, actorId: string, dto: CreateSsmRiskAssessmentDto) {
    const target = await this.validateTarget(tenantId, dto);
    const effectiveFrom = parseOptionalDate(dto.effectiveFrom);

    const result = await this.prisma.$transaction(async (tx) => {
      const assessment = await tx.ssmRiskAssessment.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          targetType: dto.targetType,
          ...target,
          createdBy: actorId
        }
      });
      const version = await tx.ssmRiskAssessmentVersion.create({
        data: {
          tenantId,
          assessmentId: assessment.id,
          versionNumber: 1,
          updateReason: dto.updateReason.trim(),
          factors: dto.factors as unknown as Prisma.InputJsonValue,
          measures: dto.measures as unknown as Prisma.InputJsonValue,
          riskLevel: dto.riskLevel,
          effectiveFrom,
          createdBy: actorId
        }
      });
      await tx.ssmRiskAssessment.update({
        where: { id: assessment.id },
        data: { activeVersionId: version.id }
      });
      return { assessmentId: assessment.id, versionId: version.id, versionNumber: version.versionNumber };
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "RISK_ASSESSMENT_CREATED",
      entityType: "SsmRiskAssessment",
      entityId: result.assessmentId,
      payload: { targetType: dto.targetType, riskLevel: dto.riskLevel, version: 1 }
    });

    return result;
  }

  async addVersion(tenantId: string, actorId: string, assessmentId: string, dto: AddSsmRiskAssessmentVersionDto) {
    const assessment = await this.prisma.ssmRiskAssessment.findFirst({
      where: { id: assessmentId, tenantId }
    });
    if (!assessment) throw new NotFoundException("Risk assessment not found.");
    if (assessment.status === SsmRiskAssessmentStatus.ARCHIVED) {
      throw new BadRequestException("Cannot version an archived risk assessment.");
    }

    const lastVersion = await this.prisma.ssmRiskAssessmentVersion.findFirst({
      where: { tenantId, assessmentId },
      orderBy: { versionNumber: "desc" }
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;
    const version = await this.prisma.ssmRiskAssessmentVersion.create({
      data: {
        tenantId,
        assessmentId,
        versionNumber: nextVersion,
        updateReason: dto.updateReason.trim(),
        factors: dto.factors as unknown as Prisma.InputJsonValue,
        measures: dto.measures as unknown as Prisma.InputJsonValue,
        riskLevel: dto.riskLevel,
        effectiveFrom: parseOptionalDate(dto.effectiveFrom),
        createdBy: actorId
      }
    });
    await this.prisma.ssmRiskAssessment.update({
      where: { id: assessmentId },
      data: { activeVersionId: version.id }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "RISK_ASSESSMENT_VERSION_ADDED",
      entityType: "SsmRiskAssessment",
      entityId: assessmentId,
      payload: { version: nextVersion, riskLevel: dto.riskLevel, reason: dto.updateReason.trim() }
    });

    return { assessmentId, versionId: version.id, versionNumber: nextVersion };
  }

  async archiveAssessment(tenantId: string, actorId: string, assessmentId: string) {
    const updated = await this.prisma.ssmRiskAssessment.updateMany({
      where: { id: assessmentId, tenantId, status: SsmRiskAssessmentStatus.ACTIVE },
      data: { status: SsmRiskAssessmentStatus.ARCHIVED }
    });
    if (!updated.count) throw new NotFoundException("Active risk assessment not found.");

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "RISK_ASSESSMENT_ARCHIVED",
      entityType: "SsmRiskAssessment",
      entityId: assessmentId
    });

    return { assessmentId, status: SsmRiskAssessmentStatus.ARCHIVED };
  }

  async listAssessments(tenantId: string, query: ListSsmRiskAssessmentsDto) {
    const rows = await this.prisma.ssmRiskAssessment.findMany({
      where: {
        tenantId,
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        activeVersion: true,
        jobPosition: { select: { name: true, code: true } },
        worksite: { select: { name: true, code: true } },
        department: { select: { name: true, code: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        targetType: row.targetType,
        targetId: row.jobPositionId ?? row.worksiteId ?? row.departmentId,
        targetLabel: row.jobPosition?.name ?? row.worksite?.name ?? row.department?.name ?? null,
        status: row.status,
        riskLevel: row.activeVersion?.riskLevel ?? null,
        activeVersionNumber: row.activeVersion?.versionNumber ?? null,
        updateReason: row.activeVersion?.updateReason ?? null,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt
      }))
    };
  }

  async history(tenantId: string, assessmentId: string) {
    const assessment = await this.prisma.ssmRiskAssessment.findFirst({
      where: { id: assessmentId, tenantId },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        activeVersion: true
      }
    });
    if (!assessment) throw new NotFoundException("Risk assessment not found.");
    return {
      assessmentId: assessment.id,
      title: assessment.title,
      activeVersionId: assessment.activeVersionId,
      versions: assessment.versions
    };
  }

  async generateExposureSheetPdf(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        jobPosition: true,
        department: true,
        worksite: { include: { legalEntity: true } }
      }
    });
    if (!employee) throw new NotFoundException("Employee not found.");

    const assessment = employee.jobPositionId
      ? await this.prisma.ssmRiskAssessment.findFirst({
          where: {
            tenantId,
            status: SsmRiskAssessmentStatus.ACTIVE,
            targetType: SsmRiskTargetType.JOB_POSITION,
            jobPositionId: employee.jobPositionId
          },
          include: { activeVersion: true }
        })
      : null;

    const version = assessment?.activeVersion;
    const factors = Array.isArray(version?.factors) ? (version?.factors as unknown[]) : [];
    const measures = Array.isArray(version?.measures) ? (version?.measures as unknown[]) : [];

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("FIȘĂ DE EXPUNERE LA RISCURI PROFESIONALE", { align: "center" });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Angajat: ${employee.fullName}`);
      doc.text(`Funcție: ${employee.jobPosition?.name ?? "-"}`);
      doc.text(`Departament: ${employee.department?.name ?? "-"}`);
      doc.text(`Punct de lucru: ${employee.worksite?.name ?? "-"}`);
      doc.text(`Entitate: ${employee.worksite?.legalEntity?.name ?? "-"}`);
      doc.text(`Data: ${new Date().toLocaleDateString("ro-RO")}`);
      doc.moveDown();
      doc.text(`Evaluare risc: ${assessment?.title ?? "Nedefinită pentru post"}`);
      doc.text(`Nivel risc: ${version?.riskLevel ?? "-"}`);
      doc.moveDown();
      doc.text("Factori de risc identificați:");
      factors.forEach((factor, index) => {
        doc.text(`${index + 1}. ${typeof factor === "string" ? factor : JSON.stringify(factor)}`);
      });
      doc.moveDown();
      doc.text("Măsuri de prevenire:");
      measures.forEach((measure, index) => {
        doc.text(`${index + 1}. ${typeof measure === "string" ? measure : JSON.stringify(measure)}`);
      });
      doc.moveDown();
      doc.fontSize(9).text("Semnătură angajat: _________________________    Data: __________");
      doc.end();
    });
  }
}
