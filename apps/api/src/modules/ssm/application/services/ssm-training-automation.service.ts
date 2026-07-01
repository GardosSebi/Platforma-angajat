import { Injectable } from "@nestjs/common";
import { EmployeeEmploymentType } from "@prisma/client";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";

export type SsmTrainingCategoryCode =
  | "INTRODUCTORY_GENERAL"
  | "WORKPLACE"
  | "PERIODIC"
  | "SUPPLEMENTARY"
  | "EMERGENCY_PSI";

const ABSENCE_SUPPLEMENTARY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SsmTrainingAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService
  ) {}

  async ensureTrainingType(tenantId: string, category: SsmTrainingCategoryCode) {
    const defaults: Record<
      SsmTrainingCategoryCode,
      { code: string; name: string; recurrenceDays?: number; legalMinDurationHours?: number }
    > = {
      INTRODUCTORY_GENERAL: {
        code: "SSM-INTRO",
        name: "Instruire introductiv-generală",
        legalMinDurationHours: 8
      },
      WORKPLACE: {
        code: "SSM-WORKPLACE",
        name: "Instruire la locul de muncă"
      },
      PERIODIC: {
        code: "SSM-PERIODIC",
        name: "Instruire periodică",
        recurrenceDays: 180
      },
      SUPPLEMENTARY: {
        code: "SSM-SUPL",
        name: "Instruire suplimentară",
        legalMinDurationHours: 8
      },
      EMERGENCY_PSI: {
        code: "PSI-EMERGENCY",
        name: "Instruire PSI / situații de urgență",
        recurrenceDays: 180
      }
    };
    const def = defaults[category];
    return this.prisma.ssmTrainingType.upsert({
      where: { tenantId_code: { tenantId, code: def.code } },
      create: {
        tenantId,
        code: def.code,
        name: def.name,
        category,
        recurrenceDays: def.recurrenceDays,
        reminderDays: [30, 15, 7],
        legalMinDurationHours: def.legalMinDurationHours
      },
      update: {
        category,
        recurrenceDays: def.recurrenceDays,
        legalMinDurationHours: def.legalMinDurationHours,
        active: true
      }
    });
  }

  async autoAssignTrainingPlan(
    tenantId: string,
    actorUserId: string,
    employeeId: string,
    category: SsmTrainingCategoryCode,
    reason: string
  ) {
    const type = await this.ensureTrainingType(tenantId, category);
    const existingOpen = await this.prisma.ssmTrainingPlan.findFirst({
      where: {
        tenantId,
        employeeId,
        trainingTypeId: type.id,
        status: { in: ["PENDING", "OVERDUE"] }
      }
    });
    if (existingOpen) {
      return existingOpen;
    }
    const now = new Date();
    const dueAt = new Date(now.getTime() + 7 * DAY_MS);
    const plan = await this.prisma.ssmTrainingPlan.create({
      data: {
        tenantId,
        employeeId,
        trainingTypeId: type.id,
        scheduledAt: now,
        dueAt,
        materialTitle: reason,
        createdBy: actorUserId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId: actorUserId,
      module: "SSM",
      action: "TRAINING_AUTO_ASSIGNED",
      entityType: "SsmTrainingPlan",
      entityId: plan.id,
      payload: { employeeId, category, reason }
    });
    await this.notifications.notifyEmployee({
      tenantId,
      employeeId,
      category: "TRAINING_ASSIGNED",
      title: `Instruire alocată: ${type.name}`,
      body: reason,
      linkPath: "/portal?tab=trainings",
      entityType: "SsmTrainingPlan",
      entityId: plan.id
    });
    return plan;
  }

  async assignOnHire(
    tenantId: string,
    actorUserId: string,
    employeeId: string,
    employmentType: EmployeeEmploymentType = EmployeeEmploymentType.OWN
  ) {
    const categories: SsmTrainingCategoryCode[] = ["WORKPLACE", "EMERGENCY_PSI"];
    if (employmentType !== EmployeeEmploymentType.EXTERNAL) {
      categories.unshift("INTRODUCTORY_GENERAL");
    }
    for (const category of categories) {
      const reason =
        category === "INTRODUCTORY_GENERAL"
          ? "Flux automat la angajare nouă"
          : category === "WORKPLACE"
            ? "Flux automat admitere la locul de muncă"
            : "Flux automat instruire PSI la angajare";
      await this.autoAssignTrainingPlan(tenantId, actorUserId, employeeId, category, reason);
    }
  }

  async assignOnPlacementChange(tenantId: string, actorUserId: string, employeeId: string) {
    await this.autoAssignTrainingPlan(
      tenantId,
      actorUserId,
      employeeId,
      "SUPPLEMENTARY",
      "Flux automat la schimbare loc de muncă/funcție"
    );
  }

  async assignOnAccidentClosed(tenantId: string, actorUserId: string, employeeId: string) {
    await this.autoAssignTrainingPlan(
      tenantId,
      actorUserId,
      employeeId,
      "SUPPLEMENTARY",
      "Flux automat după închidere caz accident de muncă"
    );
  }

  async assignOnMedicalResume(tenantId: string, actorUserId: string, employeeId: string) {
    await this.autoAssignTrainingPlan(
      tenantId,
      actorUserId,
      employeeId,
      "SUPPLEMENTARY",
      "Flux automat la reluare activitate după inaptitudine temporară"
    );
  }

  /** Cron zilnic: absență >30 zile → instruire suplimentară. */
  async processAbsenceTriggers(tenantId: string, actorUserId: string) {
    const cutoff = new Date(Date.now() - ABSENCE_SUPPLEMENTARY_DAYS * DAY_MS);
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        active: true,
        absenceStartedAt: { lte: cutoff }
      },
      select: { id: true }
    });
    let assigned = 0;
    for (const employee of employees) {
      const before = await this.prisma.ssmTrainingPlan.count({
        where: {
          tenantId,
          employeeId: employee.id,
          materialTitle: { contains: "absență" }
        }
      });
      await this.autoAssignTrainingPlan(
        tenantId,
        actorUserId,
        employee.id,
        "SUPPLEMENTARY",
        "Flux automat: absență peste 30 zile"
      );
      const after = await this.prisma.ssmTrainingPlan.count({
        where: {
          tenantId,
          employeeId: employee.id,
          materialTitle: { contains: "absență" }
        }
      });
      if (after > before) {
        assigned += 1;
      }
    }
    return { checked: employees.length, assigned };
  }
}
