import { Injectable } from "@nestjs/common";
import {
  Prisma,
  SsmEipMovementType,
  SsmTrainingCategory,
  SsmTrainingPlanStatus
} from "@prisma/client";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { SystemRole } from "../../../../common/prisma-enums";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import {
  findEmployeeIdForUserEmail,
  resolveSsmViewerScope,
  ssmEmployeeWhere
} from "../../api/ssm-viewer-scope";

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 30;

type Traffic = "GREEN" | "YELLOW" | "RED";

@Injectable()
export class SsmManagerTeamService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamOverview(tenantId: string, viewer: JwtPayload) {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    const roles = viewer.roles ?? [];
    const isAdmin = roles.includes(SystemRole.SSM_ADMIN);
    const isDeptManager = roles.includes(SystemRole.DEPARTMENT_MANAGER) && !isAdmin;

    const linked = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        active: true,
        email: { equals: viewer.email.trim(), mode: "insensitive" }
      },
      select: {
        id: true,
        fullName: true,
        departmentId: true,
        department: { select: { name: true } },
        worksite: { select: { name: true } }
      }
    });

    let where: Prisma.EmployeeWhereInput = ssmEmployeeWhere(tenantId, scope);
    if (isDeptManager && linked?.departmentId) {
      where = { ...where, departmentId: linked.departmentId };
    }

    const now = new Date();
    const soon = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        medicalBlockedAdmission: true,
        department: { select: { name: true } },
        jobPosition: { select: { name: true } },
        worksite: { select: { name: true } },
        ssmTrainingPlans: {
          select: {
            id: true,
            status: true,
            dueAt: true,
            blockedAdmission: true,
            trainingType: { select: { name: true, category: true } },
            signature: { select: { employeeSignedAt: true, managerSignedAt: true } }
          }
        },
        ssmMedicalControls: {
          orderBy: { nextDueAt: "asc" },
          take: 4,
          select: {
            nextDueAt: true,
            validityUntil: true,
            blockedAdmission: true,
            result: true,
            controlType: { select: { name: true } }
          }
        },
        ssmEipMovements: {
          where: {
            movementType: SsmEipMovementType.DISTRIBUTION,
            replacementDueAt: { not: null }
          },
          orderBy: { replacementDueAt: "asc" },
          take: 4,
          select: {
            replacementDueAt: true,
            eipType: { select: { name: true } }
          }
        }
      },
      orderBy: { fullName: "asc" }
    });

    const linkedId =
      linked?.id ?? (await findEmployeeIdForUserEmail(this.prisma, tenantId, viewer.email));

    const pendingApprovals: Array<{
      planId: string;
      employeeId: string;
      employeeName: string;
      trainingTypeName: string;
      dueAt: string;
      employeeSignedAt: string;
    }> = [];
    const alerts: Array<{
      kind: "TRAINING" | "MEDICAL" | "EIP" | "ADMISSION";
      severity: "warning" | "critical";
      employeeId: string;
      employeeName: string;
      message: string;
    }> = [];

    const members = employees.map((employee) => {
      const completed = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.COMPLETED).length;
      const overdue = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.OVERDUE).length;
      const blockedPlans = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.BLOCKED).length;
      const pending = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.PENDING).length;
      const total = employee.ssmTrainingPlans.length;
      const complianceScore = total ? Math.round((completed / total) * 100) : 100;
      const trainingBlocked = overdue > 0 || blockedPlans > 0 || employee.ssmTrainingPlans.some((p) => p.blockedAdmission);
      const blockedAdmission = employee.medicalBlockedAdmission || trainingBlocked;
      const issues: string[] = [];

      for (const plan of employee.ssmTrainingPlans) {
        if (plan.trainingType.category === SsmTrainingCategory.WORKPLACE) {
          const employeeSignedAt = plan.signature?.employeeSignedAt;
          if (employeeSignedAt && !plan.signature?.managerSignedAt) {
            pendingApprovals.push({
              planId: plan.id,
              employeeId: employee.id,
              employeeName: employee.fullName,
              trainingTypeName: plan.trainingType.name,
              dueAt: plan.dueAt.toISOString(),
              employeeSignedAt: employeeSignedAt.toISOString()
            });
          }
        }
        if (plan.status === SsmTrainingPlanStatus.OVERDUE || plan.blockedAdmission) {
          issues.push(`Instruire restantă: ${plan.trainingType.name}`);
          alerts.push({
            kind: "TRAINING",
            severity: "critical",
            employeeId: employee.id,
            employeeName: employee.fullName,
            message: `${plan.trainingType.name} — restantă (scadență ${plan.dueAt.toLocaleDateString("ro-RO")})`
          });
        }
      }

      if (employee.medicalBlockedAdmission) {
        issues.push("Blocare admitere medicală");
        alerts.push({
          kind: "ADMISSION",
          severity: "critical",
          employeeId: employee.id,
          employeeName: employee.fullName,
          message: "Nu poate fi admis la lucru (control medical)"
        });
      } else if (trainingBlocked) {
        alerts.push({
          kind: "ADMISSION",
          severity: "critical",
          employeeId: employee.id,
          employeeName: employee.fullName,
          message: "Blocare admitere — instruiri restante"
        });
      }

      let medicalNextDueAt: string | null = null;
      for (const control of employee.ssmMedicalControls) {
        const due = control.nextDueAt ?? control.validityUntil;
        if (!due) continue;
        if (!medicalNextDueAt) medicalNextDueAt = due.toISOString();
        if (due < now) {
          issues.push(`Control medical expirat: ${control.controlType.name}`);
          alerts.push({
            kind: "MEDICAL",
            severity: "critical",
            employeeId: employee.id,
            employeeName: employee.fullName,
            message: `${control.controlType.name} — expirat`
          });
        } else if (due <= soon) {
          issues.push(`Control medical în ${UPCOMING_DAYS} zile: ${control.controlType.name}`);
          alerts.push({
            kind: "MEDICAL",
            severity: "warning",
            employeeId: employee.id,
            employeeName: employee.fullName,
            message: `${control.controlType.name} — scadență ${due.toLocaleDateString("ro-RO")}`
          });
        }
      }

      let eipDueSoon = 0;
      for (const movement of employee.ssmEipMovements) {
        const due = movement.replacementDueAt;
        if (!due) continue;
        if (due <= soon) {
          eipDueSoon += 1;
          const expired = due < now;
          issues.push(`${expired ? "EIP expirat" : "EIP aproape de scadență"}: ${movement.eipType.name}`);
          alerts.push({
            kind: "EIP",
            severity: expired ? "critical" : "warning",
            employeeId: employee.id,
            employeeName: employee.fullName,
            message: `${movement.eipType.name} — ${expired ? "expirat" : "înlocuire până la"} ${due.toLocaleDateString("ro-RO")}`
          });
        }
      }

      const traffic: Traffic = blockedAdmission || overdue > 0
        ? "RED"
        : pending > 0 || eipDueSoon > 0 || issues.some((item) => item.includes("în"))
          ? "YELLOW"
          : "GREEN";

      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        isSelf: employee.id === linkedId,
        jobPositionName: employee.jobPosition?.name ?? null,
        departmentName: employee.department?.name ?? null,
        worksiteName: employee.worksite?.name ?? null,
        traffic,
        complianceScore,
        blockedAdmission,
        overdueTrainings: overdue,
        pendingTrainings: pending,
        medicalBlocked: employee.medicalBlockedAdmission,
        medicalNextDueAt,
        eipDueSoon,
        issues
      };
    });

    const memberCount = members.length;
    const compliantPercent = memberCount
      ? Math.round((members.filter((m) => m.traffic === "GREEN").length / memberCount) * 100)
      : 100;

    let scopeLabel = "Punct de lucru";
    if (isAdmin) scopeLabel = "Toate entitățile (administrator SSM)";
    else if (isDeptManager && linked?.department?.name) {
      scopeLabel = `Echipa departamentului ${linked.department.name}`;
    } else if (linked?.worksite?.name) {
      scopeLabel = `Punct de lucru ${linked.worksite.name}`;
    }

    return {
      scopeLabel,
      departmentName: linked?.department?.name ?? null,
      worksiteName: linked?.worksite?.name ?? null,
      viewerName: linked?.fullName ?? viewer.email,
      summary: {
        memberCount,
        compliantPercent,
        blockedAdmissionCount: members.filter((m) => m.blockedAdmission).length,
        pendingApprovalsCount: pendingApprovals.length,
        alertCount: alerts.length
      },
      members,
      pendingApprovals,
      alerts: alerts.slice(0, 40)
    };
  }
}
