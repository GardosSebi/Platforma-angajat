import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SsmExposureSheet,
  SsmExposureSheetStatus,
  SsmExposureSheetTrigger,
  SsmRiskAssessmentStatus,
  SsmRiskTargetType
} from "@prisma/client";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import { renderExposureSheet } from "../legal-forms/exposure-sheet";
import { assertSsmEmployeeAccess, resolveSsmViewerScope, ssmEmployeeWhere } from "../../api/ssm-viewer-scope";
import {
  IssueMissingSsmExposureSheetsDto,
  SignSsmExposureAssessorDto,
  SignSsmExposureEmployeeDto
} from "../../api/dto/ssm-exposure.dto";

const TRIGGER_LABELS: Record<SsmExposureSheetTrigger, string> = {
  HIRE: "La angajare",
  JOB_CHANGE: "Schimbare post",
  RISK_UPDATE: "Actualizare evaluare de risc",
  MANUAL: "Emisă manual"
};

const OPEN_STATUSES: SsmExposureSheetStatus[] = [
  SsmExposureSheetStatus.PENDING_SIGNATURE,
  SsmExposureSheetStatus.SIGNED
];

type SsmExposureFactor = {
  name: string;
  probability?: number | null;
  severity?: number | null;
  score?: number | null;
};

type ExposureMeasure = { title: string; owner?: string | null; dueAt?: string | null };

type SsmExposureCoverageState = "SIGNED" | "PENDING" | "OUTDATED" | "MISSING" | "NO_ASSESSMENT";

type SsmExposureCoverageItem = {
  employeeId: string;
  employeeName: string;
  jobPositionId: string | null;
  jobPositionName: string | null;
  worksiteName: string | null;
  state: SsmExposureCoverageState;
  sheetId: string | null;
  signedAt: string | null;
};

type SsmExposureCoverageResponse = {
  summary: Record<SsmExposureCoverageState, number> & { total: number };
  items: SsmExposureCoverageItem[];
};

export type SsmExposureSheetItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  jobPositionId: string | null;
  jobPositionName: string | null;
  departmentName: string | null;
  worksiteName: string | null;
  riskAssessmentId: string | null;
  riskAssessmentTitle: string | null;
  riskAssessmentVersionNumber: number | null;
  riskLevel: number | null;
  trigger: SsmExposureSheetTrigger;
  status: SsmExposureSheetStatus;
  factors: SsmExposureFactor[];
  measures: string[];
  eipItems: string[];
  employeeSignedAt: string | null;
  assessorName: string | null;
  assessorFunction: string | null;
  assessorSignedAt: string | null;
  hasPdf: boolean;
  outdated: boolean;
  createdAt: string;
};

type ExposureSnapshot = {
  employee: { fullName: string; hireDate: string | null };
  employer: { name: string | null; cui: string | null };
  worksite: string | null;
  department: string | null;
  jobPosition: { name: string | null; corCode: string | null; activityDescription: string | null };
  assessment: {
    title: string;
    versionNumber: number;
    updateReason: string;
    effectiveFrom: string | null;
    riskLevel: number;
  } | null;
  factors: SsmExposureFactor[];
  measures: ExposureMeasure[];
  eip: string[];
};

type ActiveAssessment = {
  id: string;
  title: string;
  activeVersionId: string;
  jobPositionId: string;
};

function parseFactors(value: Prisma.JsonValue): SsmExposureFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SsmExposureFactor[] => {
    if (typeof item === "string") return [{ name: item }];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") return [];
    const probability = typeof record.probability === "number" ? record.probability : null;
    const severity = typeof record.severity === "number" ? record.severity : null;
    return [
      {
        name: record.name,
        probability,
        severity,
        score: probability != null && severity != null ? probability * severity : null
      }
    ];
  });
}

function parseMeasures(value: Prisma.JsonValue): ExposureMeasure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ExposureMeasure[] => {
    if (typeof item === "string") return [{ title: item }];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.title !== "string") return [];
    return [
      {
        title: record.title,
        owner: typeof record.owner === "string" ? record.owner : null,
        dueAt: typeof record.dueAt === "string" ? record.dueAt : null
      }
    ];
  });
}

function readSnapshot(value: Prisma.JsonValue): ExposureSnapshot {
  return value as unknown as ExposureSnapshot;
}

@Injectable()
export class SsmExposureSheetService {
  private readonly logger = new Logger(SsmExposureSheetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService
  ) {}

  private async activeAssessmentsByJob(tenantId: string, jobPositionIds: string[]) {
    const ids = [...new Set(jobPositionIds.filter(Boolean))];
    const map = new Map<string, ActiveAssessment>();
    if (!ids.length) return map;
    const rows = await this.prisma.ssmRiskAssessment.findMany({
      where: {
        tenantId,
        status: SsmRiskAssessmentStatus.ACTIVE,
        targetType: SsmRiskTargetType.JOB_POSITION,
        jobPositionId: { in: ids },
        activeVersionId: { not: null }
      },
      select: { id: true, title: true, activeVersionId: true, jobPositionId: true },
      orderBy: { updatedAt: "desc" }
    });
    for (const row of rows) {
      if (!row.jobPositionId || !row.activeVersionId || map.has(row.jobPositionId)) continue;
      map.set(row.jobPositionId, {
        id: row.id,
        title: row.title,
        activeVersionId: row.activeVersionId,
        jobPositionId: row.jobPositionId
      });
    }
    return map;
  }

  private toItem(
    row: SsmExposureSheet & { employee: { fullName: string } },
    currentVersionByJob: Map<string, ActiveAssessment>
  ): SsmExposureSheetItem {
    const snapshot = readSnapshot(row.snapshot);
    const current = row.jobPositionId ? currentVersionByJob.get(row.jobPositionId) : undefined;
    const outdated =
      row.status !== SsmExposureSheetStatus.SUPERSEDED &&
      Boolean(current) &&
      current!.activeVersionId !== row.riskAssessmentVersionId;
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employee.fullName,
      jobPositionId: row.jobPositionId,
      jobPositionName: snapshot.jobPosition?.name ?? null,
      departmentName: snapshot.department ?? null,
      worksiteName: snapshot.worksite ?? null,
      riskAssessmentId: row.riskAssessmentId,
      riskAssessmentTitle: snapshot.assessment?.title ?? null,
      riskAssessmentVersionNumber: row.riskAssessmentVersionNumber,
      riskLevel: row.riskLevel,
      trigger: row.trigger,
      status: row.status,
      factors: snapshot.factors ?? [],
      measures: (snapshot.measures ?? []).map((measure) => measure.title),
      eipItems: snapshot.eip ?? [],
      employeeSignedAt: row.employeeSignedAt?.toISOString() ?? null,
      assessorName: row.assessorName,
      assessorFunction: row.assessorFunction,
      assessorSignedAt: row.assessorSignedAt?.toISOString() ?? null,
      hasPdf: Boolean(row.pdfPath),
      outdated,
      createdAt: row.createdAt.toISOString()
    };
  }

  private async loadSheet(tenantId: string, sheetId: string) {
    const sheet = await this.prisma.ssmExposureSheet.findFirst({
      where: { id: sheetId, tenantId },
      include: { employee: { select: { fullName: true } } }
    });
    if (!sheet) throw new NotFoundException("Fișa de expunere nu a fost găsită.");
    return sheet;
  }

  private async assertViewerCanAccess(tenantId: string, viewer: JwtPayload, employeeId: string) {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    await assertSsmEmployeeAccess(this.prisma, tenantId, employeeId, scope);
  }

  /**
   * Emite o fișă nouă pe baza postului și a evaluării de risc active.
   * Fișele deschise anterior sunt marcate ca înlocuite, dar rămân în arhivă.
   */
  async issue(
    tenantId: string,
    actorId: string,
    employeeId: string,
    trigger: SsmExposureSheetTrigger,
    options: { requireAssessment?: boolean } = {}
  ): Promise<SsmExposureSheetItem | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        jobPosition: true,
        department: { select: { name: true } },
        worksite: { include: { legalEntity: { select: { name: true, cui: true } } } }
      }
    });
    if (!employee) throw new NotFoundException("Angajatul nu a fost găsit.");
    if (!employee.jobPositionId || !employee.jobPosition) {
      if (options.requireAssessment) {
        throw new BadRequestException("Angajatul nu are un post de lucru alocat.");
      }
      return null;
    }

    const assessment = await this.prisma.ssmRiskAssessment.findFirst({
      where: {
        tenantId,
        status: SsmRiskAssessmentStatus.ACTIVE,
        targetType: SsmRiskTargetType.JOB_POSITION,
        jobPositionId: employee.jobPositionId,
        activeVersionId: { not: null }
      },
      include: { activeVersion: true },
      orderBy: { updatedAt: "desc" }
    });
    if (!assessment?.activeVersion) {
      if (options.requireAssessment) {
        throw new BadRequestException(
          `Postul „${employee.jobPosition.name}” nu are o evaluare de risc activă. Creează evaluarea înainte de a emite fișa.`
        );
      }
      return null;
    }
    const version = assessment.activeVersion;

    const existingPending = await this.prisma.ssmExposureSheet.findFirst({
      where: {
        tenantId,
        employeeId,
        status: SsmExposureSheetStatus.PENDING_SIGNATURE,
        jobPositionId: employee.jobPositionId,
        riskAssessmentVersionId: version.id
      },
      include: { employee: { select: { fullName: true } } }
    });
    if (existingPending) {
      const map = await this.activeAssessmentsByJob(tenantId, [employee.jobPositionId]);
      return this.toItem(existingPending, map);
    }

    const norms = await this.prisma.ssmEipNorm.findMany({
      where: { tenantId, jobPositionId: employee.jobPositionId },
      include: { eipType: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    });

    const snapshot: ExposureSnapshot = {
      employee: { fullName: employee.fullName, hireDate: employee.hireDate?.toISOString() ?? null },
      employer: {
        name: employee.worksite?.legalEntity?.name ?? null,
        cui: employee.worksite?.legalEntity?.cui ?? null
      },
      worksite: employee.worksite?.name ?? null,
      department: employee.department?.name ?? null,
      jobPosition: {
        name: employee.jobPosition.name,
        corCode: employee.jobPosition.corCode,
        activityDescription: employee.jobPosition.activityDescription
      },
      assessment: {
        title: assessment.title,
        versionNumber: version.versionNumber,
        updateReason: version.updateReason,
        effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
        riskLevel: version.riskLevel
      },
      factors: parseFactors(version.factors),
      measures: parseMeasures(version.measures),
      eip: norms.map((norm) => `${norm.eipType.name} (${norm.requiredQuantity} buc., durată ${norm.lifetimeDays} zile)`)
    };

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.ssmExposureSheet.updateMany({
        where: { tenantId, employeeId, status: { in: OPEN_STATUSES } },
        data: { status: SsmExposureSheetStatus.SUPERSEDED, supersededAt: new Date() }
      });
      return tx.ssmExposureSheet.create({
        data: {
          tenantId,
          employeeId,
          jobPositionId: employee.jobPositionId,
          riskAssessmentId: assessment.id,
          riskAssessmentVersionId: version.id,
          riskAssessmentVersionNumber: version.versionNumber,
          riskLevel: version.riskLevel,
          trigger,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          createdBy: actorId
        },
        include: { employee: { select: { fullName: true } } }
      });
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EXPOSURE_SHEET_ISSUED",
      entityType: "SsmExposureSheet",
      entityId: created.id,
      payload: {
        employeeId,
        trigger,
        riskAssessmentId: assessment.id,
        versionNumber: version.versionNumber
      }
    });

    await this.notifications.notifyEmployee({
      tenantId,
      employeeId,
      category: "SSM_EXPOSURE",
      title: "Fișă de expunere la riscuri de semnat",
      body: `A fost emisă fișa de expunere pentru postul ${employee.jobPosition.name}. Citește riscurile și semnează fișa din dosarul tău.`,
      linkPath: "/portal?tab=dossier",
      entityType: "SsmExposureSheet",
      entityId: created.id
    });

    const map = new Map<string, ActiveAssessment>([
      [
        employee.jobPositionId,
        {
          id: assessment.id,
          title: assessment.title,
          activeVersionId: version.id,
          jobPositionId: employee.jobPositionId
        }
      ]
    ]);
    return this.toItem(created, map);
  }

  async issueManual(tenantId: string, actorId: string, employeeId: string) {
    const item = await this.issue(tenantId, actorId, employeeId, SsmExposureSheetTrigger.MANUAL, {
      requireAssessment: true
    });
    return item!;
  }

  async issueMissing(tenantId: string, actor: JwtPayload, dto: IssueMissingSsmExposureSheetsDto) {
    const coverage = await this.coverage(tenantId, actor, dto);
    let issued = 0;
    for (const item of coverage.items) {
      if (item.state !== "MISSING" && item.state !== "OUTDATED") continue;
      const trigger = item.state === "OUTDATED" ? SsmExposureSheetTrigger.RISK_UPDATE : SsmExposureSheetTrigger.MANUAL;
      const result = await this.issue(tenantId, actor.sub, item.employeeId, trigger);
      if (result) issued += 1;
    }
    return { issued, noAssessment: coverage.summary.NO_ASSESSMENT };
  }

  async coverage(
    tenantId: string,
    viewer: JwtPayload,
    filter: { jobPositionId?: string; worksiteId?: string } = {}
  ): Promise<SsmExposureCoverageResponse> {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          ssmEmployeeWhere(tenantId, scope),
          { jobPositionId: filter.jobPositionId ? filter.jobPositionId : { not: null } },
          ...(filter.worksiteId ? [{ worksiteId: filter.worksiteId }] : [])
        ]
      },
      select: {
        id: true,
        fullName: true,
        jobPositionId: true,
        jobPosition: { select: { name: true } },
        worksite: { select: { name: true } }
      },
      orderBy: { fullName: "asc" }
    });

    const assessments = await this.activeAssessmentsByJob(
      tenantId,
      employees.map((employee) => employee.jobPositionId ?? "")
    );
    const sheets = await this.prisma.ssmExposureSheet.findMany({
      where: {
        tenantId,
        employeeId: { in: employees.map((employee) => employee.id) },
        status: { in: OPEN_STATUSES }
      },
      orderBy: { createdAt: "desc" }
    });
    const sheetByEmployee = new Map<string, (typeof sheets)[number]>();
    for (const sheet of sheets) {
      if (!sheetByEmployee.has(sheet.employeeId)) sheetByEmployee.set(sheet.employeeId, sheet);
    }

    const summary: SsmExposureCoverageResponse["summary"] = {
      total: employees.length,
      SIGNED: 0,
      PENDING: 0,
      OUTDATED: 0,
      MISSING: 0,
      NO_ASSESSMENT: 0
    };

    const items = employees.map((employee): SsmExposureCoverageItem => {
      const assessment = employee.jobPositionId ? assessments.get(employee.jobPositionId) : undefined;
      const sheet = sheetByEmployee.get(employee.id);
      let state: SsmExposureCoverageState;
      if (!assessment) state = "NO_ASSESSMENT";
      else if (!sheet) state = "MISSING";
      else if (sheet.jobPositionId !== employee.jobPositionId || sheet.riskAssessmentVersionId !== assessment.activeVersionId) {
        state = "OUTDATED";
      } else if (sheet.status === SsmExposureSheetStatus.SIGNED) state = "SIGNED";
      else state = "PENDING";
      summary[state] += 1;
      return {
        employeeId: employee.id,
        employeeName: employee.fullName,
        jobPositionId: employee.jobPositionId,
        jobPositionName: employee.jobPosition?.name ?? null,
        worksiteName: employee.worksite?.name ?? null,
        state,
        sheetId: sheet?.id ?? null,
        signedAt:
          sheet?.status === SsmExposureSheetStatus.SIGNED
            ? (sheet.assessorSignedAt && sheet.employeeSignedAt && sheet.assessorSignedAt > sheet.employeeSignedAt
                ? sheet.assessorSignedAt
                : sheet.employeeSignedAt ?? sheet.updatedAt
              ).toISOString()
            : null
      };
    });

    return { summary, items };
  }

  async list(
    tenantId: string,
    viewer: JwtPayload,
    filter: { employeeId?: string; status?: SsmExposureSheetStatus } = {}
  ) {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (filter.employeeId) {
      await assertSsmEmployeeAccess(this.prisma, tenantId, filter.employeeId, scope);
    }
    const rows = await this.prisma.ssmExposureSheet.findMany({
      where: {
        tenantId,
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        employee: ssmEmployeeWhere(tenantId, scope)
      },
      include: { employee: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    const map = await this.activeAssessmentsByJob(
      tenantId,
      rows.map((row) => row.jobPositionId ?? "")
    );
    return { items: rows.map((row) => this.toItem(row, map)) };
  }

  async signEmployee(tenantId: string, viewer: JwtPayload, sheetId: string, dto: SignSsmExposureEmployeeDto) {
    const sheet = await this.loadSheet(tenantId, sheetId);
    await this.assertViewerCanAccess(tenantId, viewer, sheet.employeeId);
    if (sheet.status !== SsmExposureSheetStatus.PENDING_SIGNATURE) {
      throw new BadRequestException("Fișa nu mai poate fi semnată (este deja semnată sau înlocuită).");
    }
    if (sheet.employeeSignedAt) {
      throw new BadRequestException("Lucrătorul a semnat deja această fișă.");
    }
    await this.prisma.ssmExposureSheet.update({
      where: { id: sheet.id },
      data: { employeeSignature: dto.signature, employeeSignedAt: new Date() }
    });
    await this.auditLog.write({
      tenantId,
      actorId: viewer.sub,
      module: "SSM",
      action: "EXPOSURE_SHEET_EMPLOYEE_SIGNED",
      entityType: "SsmExposureSheet",
      entityId: sheet.id,
      payload: { employeeId: sheet.employeeId }
    });
    return this.finalizeIfComplete(tenantId, viewer.sub, sheet.id);
  }

  async signAssessor(tenantId: string, viewer: JwtPayload, sheetId: string, dto: SignSsmExposureAssessorDto) {
    const sheet = await this.loadSheet(tenantId, sheetId);
    await this.assertViewerCanAccess(tenantId, viewer, sheet.employeeId);
    if (sheet.status !== SsmExposureSheetStatus.PENDING_SIGNATURE) {
      throw new BadRequestException("Fișa nu mai poate fi semnată (este deja semnată sau înlocuită).");
    }
    await this.prisma.ssmExposureSheet.update({
      where: { id: sheet.id },
      data: {
        assessorName: dto.assessorName.trim(),
        assessorFunction: dto.assessorFunction?.trim() || null,
        assessorSignature: dto.signature,
        assessorSignedAt: new Date()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId: viewer.sub,
      module: "SSM",
      action: "EXPOSURE_SHEET_ASSESSOR_SIGNED",
      entityType: "SsmExposureSheet",
      entityId: sheet.id,
      payload: { employeeId: sheet.employeeId, assessorName: dto.assessorName.trim() }
    });
    return this.finalizeIfComplete(tenantId, viewer.sub, sheet.id);
  }

  private renderSheet(sheet: SsmExposureSheet) {
    const snapshot = readSnapshot(sheet.snapshot);
    return renderExposureSheet({
      employerName: snapshot.employer?.name,
      employerCui: snapshot.employer?.cui,
      worksiteName: snapshot.worksite,
      departmentName: snapshot.department,
      employeeName: snapshot.employee.fullName,
      hireDate: snapshot.employee.hireDate,
      jobPositionName: snapshot.jobPosition?.name,
      corCode: snapshot.jobPosition?.corCode,
      activityDescription: snapshot.jobPosition?.activityDescription,
      issuedAt: sheet.createdAt,
      triggerLabel: TRIGGER_LABELS[sheet.trigger],
      assessment: snapshot.assessment,
      factors: snapshot.factors ?? [],
      measures: snapshot.measures ?? [],
      eipItems: snapshot.eip ?? [],
      employeeSignature: sheet.employeeSignature,
      employeeSignedAt: sheet.employeeSignedAt,
      assessorName: sheet.assessorName,
      assessorFunction: sheet.assessorFunction,
      assessorSignature: sheet.assessorSignature,
      assessorSignedAt: sheet.assessorSignedAt
    });
  }

  private async finalizeIfComplete(tenantId: string, actorId: string, sheetId: string) {
    const sheet = await this.loadSheet(tenantId, sheetId);
    if (sheet.employeeSignedAt && sheet.assessorSignedAt && !sheet.pdfPath) {
      const buffer = await this.renderSheet(sheet);
      const targetDir = resolve(process.cwd(), "uploads", "ssm-exposure", tenantId, sheet.employeeId);
      await mkdir(targetDir, { recursive: true });
      const fileName = `Fisa-expunere-${sheet.createdAt.toISOString().slice(0, 10)}-${sheet.id.slice(0, 8)}.pdf`;
      const absolutePath = resolve(targetDir, fileName);
      await writeFile(absolutePath, buffer);
      await this.prisma.ssmExposureSheet.update({
        where: { id: sheet.id },
        data: {
          status: SsmExposureSheetStatus.SIGNED,
          pdfPath: absolutePath,
          pdfFileName: fileName
        }
      });
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "EXPOSURE_SHEET_ARCHIVED",
        entityType: "SsmExposureSheet",
        entityId: sheet.id,
        payload: { employeeId: sheet.employeeId, fileName }
      });
    }
    const updated = await this.loadSheet(tenantId, sheetId);
    const map = await this.activeAssessmentsByJob(tenantId, [updated.jobPositionId ?? ""]);
    return this.toItem(updated, map);
  }

  async pdf(tenantId: string, viewer: JwtPayload, sheetId: string) {
    const sheet = await this.loadSheet(tenantId, sheetId);
    await this.assertViewerCanAccess(tenantId, viewer, sheet.employeeId);
    if (sheet.pdfPath) {
      try {
        return { buffer: await readFile(sheet.pdfPath), fileName: sheet.pdfFileName ?? `fisa-expunere-${sheet.id}.pdf` };
      } catch {
        this.logger.warn(`Exposure sheet PDF missing on disk for ${sheet.id}; regenerating from snapshot.`);
      }
    }
    return { buffer: await this.renderSheet(sheet), fileName: `fisa-expunere-${sheet.id}.pdf` };
  }

  /** Fișele (inclusiv cele înlocuite) pentru dosarul digital; fără verificare de acces — apelantul o face. */
  async forDossier(tenantId: string, employeeId: string) {
    const rows = await this.prisma.ssmExposureSheet.findMany({
      where: { tenantId, employeeId },
      include: { employee: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" }
    });
    const map = await this.activeAssessmentsByJob(
      tenantId,
      rows.map((row) => row.jobPositionId ?? "")
    );
    return rows.map((row) => ({ item: this.toItem(row, map), pdfPath: row.pdfPath, pdfFileName: row.pdfFileName }));
  }

  async onHire(tenantId: string, actorId: string, employeeId: string) {
    try {
      await this.issue(tenantId, actorId, employeeId, SsmExposureSheetTrigger.HIRE);
    } catch (error) {
      this.logger.warn(`Exposure sheet on hire failed for ${employeeId}: ${String(error)}`);
    }
  }

  async onPlacementChange(tenantId: string, actorId: string, employeeId: string) {
    try {
      const [employee, latest] = await Promise.all([
        this.prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { jobPositionId: true } }),
        this.prisma.ssmExposureSheet.findFirst({
          where: { tenantId, employeeId, status: { in: OPEN_STATUSES } },
          orderBy: { createdAt: "desc" },
          select: { jobPositionId: true }
        })
      ]);
      if (!employee?.jobPositionId || latest?.jobPositionId === employee.jobPositionId) return;
      await this.issue(tenantId, actorId, employeeId, SsmExposureSheetTrigger.JOB_CHANGE);
    } catch (error) {
      this.logger.warn(`Exposure sheet on placement change failed for ${employeeId}: ${String(error)}`);
    }
  }

  /** La o versiune nouă a evaluării pe post, toți lucrătorii activi de pe post primesc o fișă nouă de semnat. */
  async onRiskAssessmentVersion(tenantId: string, actorId: string, assessmentId: string) {
    const assessment = await this.prisma.ssmRiskAssessment.findFirst({
      where: { id: assessmentId, tenantId, targetType: SsmRiskTargetType.JOB_POSITION },
      select: { jobPositionId: true }
    });
    if (!assessment?.jobPositionId) return { issued: 0 };
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, active: true, jobPositionId: assessment.jobPositionId },
      select: { id: true }
    });
    let issued = 0;
    for (const employee of employees) {
      try {
        const result = await this.issue(tenantId, actorId, employee.id, SsmExposureSheetTrigger.RISK_UPDATE);
        if (result) issued += 1;
      } catch (error) {
        this.logger.warn(`Exposure sheet reissue failed for ${employee.id}: ${String(error)}`);
      }
    }
    return { issued };
  }
}
