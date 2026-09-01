import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EmployeeEmploymentType,
  SsmGateVisitStatus,
  SsmGateVisitorKind,
  SsmTrainingPlanStatus
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import {
  BriefGateVisitDto,
  CreateGateVisitDto,
  SignGateVisitDto
} from "../../api/dto/ssm-gate.dto";
import { renderAnexa12CollectiveSheet } from "../legal-forms/anexa-12-collective-sheet";
import { resolveSsmViewerScope, ssmEmployeeWhere } from "../../api/ssm-viewer-scope";

const KIND_FROM_EMPLOYMENT: Record<EmployeeEmploymentType, SsmGateVisitorKind> = {
  OWN: SsmGateVisitorKind.VISITOR,
  DETACHED: SsmGateVisitorKind.DETACHED,
  TEMPORARY: SsmGateVisitorKind.TEMPORARY,
  EXTERNAL: SsmGateVisitorKind.EXTERNAL
};

@Injectable()
export class SsmGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private mapVisit(
    row: Awaited<ReturnType<SsmGateService["loadVisit"]>>
  ) {
    if (!row) return null;
    return {
      id: row.id,
      worksiteId: row.worksiteId,
      worksiteName: row.worksite?.name ?? null,
      companyName: row.companyName,
      purpose: row.purpose,
      trainerName: row.trainerName,
      trainerFunction: row.trainerFunction,
      location: row.location,
      briefingTitle: row.briefingTitle,
      briefingNotes: row.briefingNotes,
      status: row.status,
      visitDate: row.visitDate,
      completedAt: row.completedAt,
      attendees: row.attendees.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        fullName: a.fullName,
        company: a.company,
        idDocument: a.idDocument,
        visitorKind: a.visitorKind,
        trainingAcknowledgedAt: a.trainingAcknowledgedAt,
        signedAt: a.signedAt,
        hasSignature: Boolean(a.signatureData)
      })),
      createdAt: row.createdAt
    };
  }

  private async loadVisit(tenantId: string, visitId: string) {
    return this.prisma.ssmGateVisit.findFirst({
      where: { id: visitId, tenantId },
      include: {
        worksite: { select: { name: true } },
        attendees: { orderBy: { createdAt: "asc" } }
      }
    });
  }

  async listVisits(tenantId: string, worksiteId?: string) {
    const rows = await this.prisma.ssmGateVisit.findMany({
      where: { tenantId, ...(worksiteId ? { worksiteId } : {}) },
      include: {
        worksite: { select: { name: true } },
        attendees: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { visitDate: "desc" },
      take: 100
    });
    return { items: rows.map((row) => this.mapVisit(row)!) };
  }

  async getVisit(tenantId: string, visitId: string) {
    const row = await this.loadVisit(tenantId, visitId);
    if (!row) throw new NotFoundException("Vizita de poartă nu a fost găsită.");
    return this.mapVisit(row);
  }

  async createVisit(tenantId: string, actorId: string, dto: CreateGateVisitDto) {
    if (dto.worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: dto.worksiteId, tenantId, active: true }
      });
      if (!worksite) throw new NotFoundException("Punct de lucru invalid.");
    }

    const employeeIds = dto.attendees.map((a) => a.employeeId).filter((id): id is string => Boolean(id));
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: { tenantId, id: { in: employeeIds } },
          select: { id: true, fullName: true, employmentType: true }
        })
      : [];
    const employeeById = new Map(employees.map((e) => [e.id, e]));

    const created = await this.prisma.ssmGateVisit.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        purpose: dto.purpose?.trim() || null,
        trainerName: dto.trainerName?.trim() || null,
        trainerFunction: dto.trainerFunction?.trim() || null,
        location: dto.location?.trim() || null,
        briefingTitle: dto.briefingTitle.trim(),
        visitDate: dto.visitDate ? new Date(dto.visitDate) : new Date(),
        createdBy: actorId,
        attendees: {
          create: dto.attendees.map((attendee) => {
            const linked = attendee.employeeId ? employeeById.get(attendee.employeeId) : undefined;
            return {
              tenantId,
              employeeId: linked?.id ?? null,
              fullName: linked?.fullName ?? attendee.fullName.trim(),
              company: attendee.company?.trim() || null,
              idDocument: attendee.idDocument?.trim() || null,
              visitorKind:
                attendee.visitorKind ??
                (linked ? KIND_FROM_EMPLOYMENT[linked.employmentType] : SsmGateVisitorKind.VISITOR)
            };
          })
        }
      },
      include: {
        worksite: { select: { name: true } },
        attendees: { orderBy: { createdAt: "asc" } }
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "GATE_VISIT_CREATED",
      entityType: "SsmGateVisit",
      entityId: created.id,
      payload: { attendees: created.attendees.length }
    });

    return this.mapVisit(created);
  }

  async briefVisit(tenantId: string, actorId: string, visitId: string, dto: BriefGateVisitDto) {
    const visit = await this.loadVisit(tenantId, visitId);
    if (!visit) throw new NotFoundException("Vizita de poartă nu a fost găsită.");
    if (visit.status === SsmGateVisitStatus.CANCELLED || visit.status === SsmGateVisitStatus.SIGNED) {
      throw new BadRequestException("Vizita nu mai poate primi instruire.");
    }

    const attendeeIds = dto.attendeeIds?.length ? dto.attendeeIds : visit.attendees.map((a) => a.id);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.ssmGateVisit.update({
        where: { id: visitId },
        data: {
          briefingNotes: dto.briefingNotes?.trim() || visit.briefingNotes,
          status: SsmGateVisitStatus.BRIEFING
        }
      }),
      this.prisma.ssmGateVisitAttendee.updateMany({
        where: { tenantId, visitId, id: { in: attendeeIds } },
        data: { trainingAcknowledgedAt: now }
      })
    ]);

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "GATE_VISIT_BRIEFED",
      entityType: "SsmGateVisit",
      entityId: visitId
    });

    return this.getVisit(tenantId, visitId);
  }

  async signVisit(tenantId: string, actorId: string, visitId: string, dto: SignGateVisitDto) {
    const visit = await this.loadVisit(tenantId, visitId);
    if (!visit) throw new NotFoundException("Vizita de poartă nu a fost găsită.");
    if (visit.status === SsmGateVisitStatus.CANCELLED) {
      throw new BadRequestException("Vizita a fost anulată.");
    }
    if (visit.status === SsmGateVisitStatus.REGISTERED) {
      throw new BadRequestException("Parcurgeți mai întâi instruirea scurtă.");
    }

    const attendeeIds = new Set(visit.attendees.map((a) => a.id));
    for (const signature of dto.signatures) {
      if (!attendeeIds.has(signature.attendeeId)) {
        throw new BadRequestException("Semnătura nu corespunde unui participant al vizitei.");
      }
      if (!signature.signatureData.startsWith("data:image")) {
        throw new BadRequestException("Semnătura trebuie capturată olograf în aplicație.");
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const signature of dto.signatures) {
        await tx.ssmGateVisitAttendee.update({
          where: { id: signature.attendeeId },
          data: { signatureData: signature.signatureData, signedAt: now }
        });
      }
      const remaining = await tx.ssmGateVisitAttendee.count({
        where: { visitId, signedAt: null }
      });
      await tx.ssmGateVisit.update({
        where: { id: visitId },
        data: {
          trainerSignature: dto.trainerSignature?.startsWith("data:image")
            ? dto.trainerSignature
            : visit.trainerSignature,
          status: remaining === 0 ? SsmGateVisitStatus.SIGNED : SsmGateVisitStatus.BRIEFING,
          completedAt: remaining === 0 ? now : null
        }
      });
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "GATE_VISIT_SIGNED",
      entityType: "SsmGateVisit",
      entityId: visitId,
      payload: { signed: dto.signatures.length }
    });

    return this.getVisit(tenantId, visitId);
  }

  async anexa12Pdf(tenantId: string, visitId: string) {
    const visit = await this.loadVisit(tenantId, visitId);
    if (!visit) throw new NotFoundException("Vizita de poartă nu a fost găsită.");

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const legalEntity = await this.prisma.legalEntity.findFirst({
      where: { tenantId, active: true },
      orderBy: { createdAt: "asc" },
      select: { name: true, cui: true }
    });

    return renderAnexa12CollectiveSheet({
      companyName: legalEntity?.name ?? tenant?.name ?? tenantId,
      cui: legalEntity?.cui,
      title: [visit.briefingTitle, visit.briefingNotes].filter(Boolean).join("\n"),
      trainerName: visit.trainerName,
      trainerFunction: visit.trainerFunction,
      trainerSignatureData: visit.trainerSignature,
      location: visit.location ?? visit.worksite?.name,
      visitDates: visit.visitDate.toLocaleDateString("ro-RO"),
      createdAt: visit.visitDate,
      attendees: visit.attendees.map((a) => ({
        name: a.fullName,
        identity: [a.idDocument, a.company, visitorKindLabel(a.visitorKind)].filter(Boolean).join(" · "),
        signatureData: a.signatureData
      }))
    });
  }

  async listAdmissionBlocks(tenantId: string, viewer: JwtPayload, worksiteId?: string) {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    const employees = await this.prisma.employee.findMany({
      where: {
        ...ssmEmployeeWhere(tenantId, scope),
        ...(worksiteId ? { worksiteId } : {}),
        OR: [
          { medicalBlockedAdmission: true },
          { ssmTrainingPlans: { some: { blockedAdmission: true, status: { not: SsmTrainingPlanStatus.COMPLETED } } } }
        ]
      },
      include: {
        worksite: { select: { id: true, name: true } },
        department: { select: { name: true } },
        jobPosition: { select: { name: true } },
        ssmTrainingPlans: {
          where: { blockedAdmission: true, status: { not: SsmTrainingPlanStatus.COMPLETED } },
          select: { id: true }
        },
        ssmMedicalControls: {
          where: { blockedAdmission: true },
          orderBy: { performedAt: "desc" },
          take: 1,
          select: { result: true }
        }
      },
      orderBy: { fullName: "asc" }
    });

    return {
      items: employees.map((emp) => {
        const reasons: Array<"TRAINING" | "MEDICAL"> = [];
        if (emp.ssmTrainingPlans.length) reasons.push("TRAINING");
        if (emp.medicalBlockedAdmission) reasons.push("MEDICAL");
        return {
          employeeId: emp.id,
          fullName: emp.fullName,
          employmentType: emp.employmentType,
          worksiteId: emp.worksiteId,
          worksiteName: emp.worksite?.name ?? null,
          departmentName: emp.department?.name ?? null,
          jobPositionName: emp.jobPosition?.name ?? null,
          reasons,
          trainingOverdueCount: emp.ssmTrainingPlans.length,
          medicalBlocked: emp.medicalBlockedAdmission,
          lastMedicalResult: emp.ssmMedicalControls[0]?.result ?? null
        };
      })
    };
  }
}

function visitorKindLabel(kind: SsmGateVisitorKind): string {
  switch (kind) {
    case SsmGateVisitorKind.DETACHED:
      return "Detașat";
    case SsmGateVisitorKind.TEMPORARY:
      return "Temporar";
    case SsmGateVisitorKind.EXTERNAL:
      return "Extern";
    default:
      return "Vizitator";
  }
}
