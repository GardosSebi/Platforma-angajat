import { readFile } from "fs/promises";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SsmTrainingCategory,
  SsmTrainingPlanStatus
} from "@prisma/client";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { hasAllPermissions, Permission } from "../../../../common/constants/permissions";
import { SystemRole } from "../../../../common/prisma-enums";
import {
  assertSsmEmployeeAccess,
  findEmployeeIdForUserEmail,
  resolveSsmViewerScope,
  ssmEmployeeWhere,
  ssmTrainingPlanWhere
} from "../../api/ssm-viewer-scope";
import {
  CompleteTestDto,
  CreateTrainingPlanDto,
  CreateTrainingTypeDto,
  GenerateCollectiveSheetDto,
  SignPlanDto,
  SignPlansBatchDto
} from "../../api/dto/training-suite.dto";
import {
  buildTrainingTestPresentation,
  gradeTrainingTestAnswers,
  rebuildPublicQuestions,
  resolveTrainingTestQuestions,
  resolveTrainingTestQuestionsFromType,
  SSM_TRAINING_PASS_THRESHOLD_PERCENT,
  type SsmTrainingTestAttemptMeta
} from "../training-test-bank";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

function daysDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

type MedicalControlForDossier = {
  id: string;
  scheduledAt: Date;
  performedAt: Date | null;
  nextDueAt: Date | null;
  result: string | null;
  aptitudeSheetName: string | null;
  controlType: {
    name: string;
  };
};

type PrismaWithMedicalControl = PrismaService & {
  ssmMedicalControl: {
    findMany(args: {
      where: { tenantId: string; employeeId: string };
      include: { controlType: { select: { name: true } } };
      orderBy: { scheduledAt: "asc" | "desc" };
    }): Promise<MedicalControlForDossier[]>;
  };
};

type SsmTrainingCategoryCode =
  | "INTRODUCTORY_GENERAL"
  | "WORKPLACE"
  | "PERIODIC"
  | "SUPPLEMENTARY"
  | "EMERGENCY_PSI";

type PrismaWithTrainingTypeExtended = PrismaService & {
  ssmTrainingType: {
    create(args: {
      data: {
        tenantId: string;
        code: string;
        name: string;
        category: SsmTrainingCategoryCode;
        legalMinDurationHours?: number;
        description?: string;
        recurrenceDays?: number;
        reminderDays: number[];
      };
    }): Promise<{ id: string; code: string }>;
  };
};

type TrainingPlanForTest = {
  id: string;
  materialTitle?: string | null;
  materialUrl?: string | null;
  materialCompletedAt?: Date | null;
  score?: number | null;
  status: SsmTrainingPlanStatus;
  attempts: Array<{ id: string; finishedAt: Date | null; passed: boolean | null; answersJson: unknown }>;
  trainingType: {
    legalMinDurationHours?: number | null;
    name: string;
    category: SsmTrainingCategoryCode;
  };
};

type PrismaWithTrainingPlanLegal = PrismaService & {
  ssmTrainingPlan: {
    findFirst(args: {
      where: { id: string; tenantId: string };
      include: {
        trainingType: { select: { legalMinDurationHours: true; name: true; category: true } };
        attempts: { orderBy: { startedAt: "asc" | "desc" }; take: number };
      };
    }): Promise<TrainingPlanForTest | null>;
  };
};

type PrismaWithReminderDispatch = PrismaService & {
  ssmTrainingReminderDispatch: {
    findUnique(args: {
      where: {
        trainingPlanId_daysUntilDue_channel: {
          trainingPlanId: string;
          daysUntilDue: number;
          channel: string;
        };
      };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        tenantId: string;
        trainingPlanId: string;
        daysUntilDue: number;
        channel: string;
      };
    }): Promise<{ id: string }>;
  };
};

const LEGAL_MIN_HOURS_BY_CATEGORY: Partial<Record<SsmTrainingCategoryCode, number>> = {
  INTRODUCTORY_GENERAL: 8,
  SUPPLEMENTARY: 8
};

const DEFAULT_REMINDER_DAYS = [30, 15, 7];

@Injectable()
export class SsmTrainingSuiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
    private readonly notifications: NotificationsService
  ) {}

  private async syncOverdue(tenantId: string) {
    const result = await this.prisma.ssmTrainingPlan.updateMany({
      where: {
        tenantId,
        status: SsmTrainingPlanStatus.PENDING,
        dueAt: { lt: new Date() }
      },
      data: {
        status: SsmTrainingPlanStatus.OVERDUE,
        blockedAdmission: true
      }
    });
    return result.count;
  }

  /** Marchează planurile restante — apelat din cron zilnic înainte de remindere. */
  async markOverduePlans(tenantId: string) {
    const marked = await this.syncOverdue(tenantId);
    return { marked };
  }

  async listTrainingTypes(tenantId: string) {
    return this.prisma.ssmTrainingType.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { code: "asc" }]
    });
  }

  async createTrainingType(tenantId: string, actorId: string, dto: CreateTrainingTypeDto) {
    const category = (dto.category ?? "PERIODIC") as SsmTrainingCategoryCode;
    const legalMinimum = LEGAL_MIN_HOURS_BY_CATEGORY[category];
    if (legalMinimum && (dto.legalMinDurationHours ?? legalMinimum) < legalMinimum) {
      throw new BadRequestException(
        `${category} requires at least ${legalMinimum} legal hours.`
      );
    }
    const created = await (this.prisma as PrismaWithTrainingTypeExtended).ssmTrainingType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category,
        legalMinDurationHours: dto.legalMinDurationHours ?? legalMinimum,
        description: dto.description?.trim(),
        recurrenceDays: dto.recurrenceDays,
        reminderDays: dto.reminderDays ?? [30, 15, 7],
        testQuestionsJson: dto.testQuestions?.length
          ? (dto.testQuestions as unknown as Prisma.InputJsonValue)
          : undefined
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "TRAINING_TYPE_CREATED",
      entityType: "SsmTrainingType",
      entityId: created.id,
      payload: { code: created.code }
    });
    return created;
  }

  async createTrainingPlan(tenantId: string, actorId: string, dto: CreateTrainingPlanDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, active: true }
    });
    if (!employee) {
      throw new NotFoundException("Employee not found for tenant.");
    }
    const type = await this.prisma.ssmTrainingType.findFirst({
      where: { id: dto.trainingTypeId, tenantId, active: true }
    });
    if (!type) {
      throw new NotFoundException("Training type not found for tenant.");
    }

    const scheduledAt = parseDate(dto.scheduledAt);
    const dueAt = parseDate(dto.dueAt);
    if (scheduledAt > dueAt) {
      throw new BadRequestException("scheduledAt must be before dueAt.");
    }

    const created = await this.prisma.ssmTrainingPlan.create({
      data: {
        tenantId,
        employeeId: employee.id,
        trainingTypeId: type.id,
        scheduledAt,
        dueAt,
        materialTitle: dto.materialTitle?.trim(),
        materialUrl: dto.materialUrl?.trim(),
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "TRAINING_PLAN_CREATED",
      entityType: "SsmTrainingPlan",
      entityId: created.id,
      payload: { employeeId: created.employeeId, trainingTypeId: created.trainingTypeId }
    });

    if (employee.email) {
      await this.mailService.sendMail({
        to: employee.email,
        subject: `Instruire SSM alocată: ${type.name}`,
        text: [
          `Ai o instruire nouă alocată în platformă.`,
          `Tip: ${type.name} (${type.code})`,
          `Scadență: ${dueAt.toISOString()}`,
          `Te rugăm să parcurgi materialul și să completezi testul final.`
        ].join("\n")
      });
    }

    await this.notifications.notifyEmployee({
      tenantId,
      employeeId: employee.id,
      category: "TRAINING_ASSIGNED",
      title: `Instruire alocată: ${type.name}`,
      body: `Scadență: ${dueAt.toLocaleDateString("ro-RO")}. Parcurge materialul și completează testul.`,
      linkPath: "/portal?tab=trainings",
      entityType: "SsmTrainingPlan",
      entityId: created.id
    });

    return created;
  }

  private planHasMaterial(plan: { materialUrl?: string | null; materialTitle?: string | null }): boolean {
    return Boolean(plan.materialUrl?.trim() || plan.materialTitle?.trim());
  }

  private assertTrainingPlanActiveForWorkflow(plan: { status: SsmTrainingPlanStatus; score?: number | null }) {
    if (plan.status === SsmTrainingPlanStatus.COMPLETED) {
      throw new BadRequestException("Instruirea este deja validată de responsabilul SSM.");
    }
    if (plan.status === SsmTrainingPlanStatus.BLOCKED) {
      throw new BadRequestException("Instruirea este blocată după testul eșuat. Contactați responsabilul SSM.");
    }
    if (plan.score != null) {
      throw new BadRequestException("Testul a fost deja finalizat. Continuați cu semnătura.");
    }
  }

  private assertMaterialReady(plan: {
    materialUrl?: string | null;
    materialTitle?: string | null;
    materialCompletedAt?: Date | null;
  }) {
    if (this.planHasMaterial(plan) && !plan.materialCompletedAt) {
      throw new BadRequestException("Confirmați parcurgerea materialului înainte de a porni testul.");
    }
  }

  private parseAttemptMeta(raw: unknown): SsmTrainingTestAttemptMeta | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const meta = record.__meta__;
    if (!meta || typeof meta !== "object") return null;
    const metaRecord = meta as SsmTrainingTestAttemptMeta;
    if (!Array.isArray(metaRecord.questionIds) || typeof metaRecord.permutations !== "object") {
      return null;
    }
    return metaRecord;
  }

  async startMaterial(tenantId: string, actorId: string, trainingPlanId: string, viewer: JwtPayload) {
    await this.assertTrainingPlanVisibleToViewer(tenantId, trainingPlanId, viewer);
    const plan = await this.prisma.ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    if (!this.planHasMaterial(plan)) {
      throw new BadRequestException("Nu există material de parcurs pentru această instruire.");
    }
    if (plan.materialCompletedAt) {
      return {
        trainingPlanId,
        materialStartedAt: plan.materialStartedAt?.toISOString() ?? null,
        materialTimeSpentSeconds: plan.materialTimeSpentSeconds ?? 0
      };
    }
    const now = new Date();
    const startedAt = plan.materialStartedAt ?? now;
    if (!plan.materialStartedAt) {
      await this.prisma.ssmTrainingPlan.update({
        where: { id: trainingPlanId },
        data: { materialStartedAt: startedAt }
      });
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "ELEARNING_MATERIAL_STARTED",
        entityType: "SsmTrainingPlan",
        entityId: trainingPlanId
      });
    }
    return {
      trainingPlanId,
      materialStartedAt: startedAt.toISOString(),
      materialTimeSpentSeconds: plan.materialTimeSpentSeconds ?? 0
    };
  }

  async markMaterialCompleted(
    tenantId: string,
    actorId: string,
    trainingPlanId: string,
    viewer: JwtPayload,
    durationSeconds?: number
  ) {
    await this.assertTrainingPlanVisibleToViewer(tenantId, trainingPlanId, viewer);
    const plan = await (this.prisma as PrismaWithTrainingPlanLegal).ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      include: {
        trainingType: {
          select: {
            legalMinDurationHours: true,
            name: true
          }
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    this.assertTrainingPlanActiveForWorkflow(plan);
    if (!this.planHasMaterial(plan)) {
      throw new BadRequestException("Nu există material de parcurs pentru această instruire.");
    }
    if (plan.materialCompletedAt) {
      return { trainingPlanId, materialCompleted: true };
    }

    const now = new Date();
    const trackedSeconds =
      durationSeconds ??
      (plan.materialStartedAt
        ? Math.max(0, Math.floor((now.getTime() - plan.materialStartedAt.getTime()) / 1000))
        : plan.materialTimeSpentSeconds ?? 0);

    if (plan.trainingType.legalMinDurationHours && trackedSeconds > 0) {
      const minimumSeconds = plan.trainingType.legalMinDurationHours * 60 * 60;
      if (trackedSeconds < minimumSeconds) {
        throw new BadRequestException(
          `Durata minimă legală de parcurgere a materialului este ${plan.trainingType.legalMinDurationHours} ore. Timp înregistrat: ${Math.ceil(trackedSeconds / 60)} minute.`
        );
      }
    }

    await this.prisma.ssmTrainingPlan.update({
      where: { id: trainingPlanId },
      data: {
        materialStartedAt: plan.materialStartedAt ?? now,
        materialCompletedAt: now,
        materialTimeSpentSeconds: trackedSeconds,
        durationMinutes: trackedSeconds ? Math.ceil(trackedSeconds / 60) : plan.durationMinutes
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ELEARNING_MATERIAL_COMPLETED",
      entityType: "SsmTrainingPlan",
      entityId: trainingPlanId
    });
    return { trainingPlanId, materialCompleted: true };
  }

  async startTestAttempt(tenantId: string, actorId: string, trainingPlanId: string, viewer: JwtPayload) {
    await this.assertTrainingPlanVisibleToViewer(tenantId, trainingPlanId, viewer);
    const plan = await (this.prisma as PrismaWithTrainingPlanLegal).ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      include: {
        trainingType: {
          select: {
            legalMinDurationHours: true,
            name: true,
            category: true,
            testQuestionsJson: true
          }
        },
        attempts: {
          orderBy: { startedAt: "desc" },
          take: 1
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    this.assertTrainingPlanActiveForWorkflow(plan);
    this.assertMaterialReady(plan);

    const bank = resolveTrainingTestQuestionsFromType(
      plan.trainingType.category as SsmTrainingCategoryCode,
      (plan.trainingType as { testQuestionsJson?: unknown }).testQuestionsJson
    );
    const latestAttempt = plan.attempts[0];
    if (latestAttempt && !latestAttempt.finishedAt) {
      const existingMeta = this.parseAttemptMeta(latestAttempt.answersJson);
      if (existingMeta) {
        const questions = rebuildPublicQuestions(existingMeta, bank);
        return {
          attemptId: latestAttempt.id,
          questions,
          passThresholdPercent: SSM_TRAINING_PASS_THRESHOLD_PERCENT
        };
      }
    }

    const { meta, questions } = buildTrainingTestPresentation(bank);
    const attempt = await this.prisma.ssmTrainingTestAttempt.create({
      data: {
        tenantId,
        trainingPlanId,
        answersJson: { __meta__: meta } as unknown as Prisma.InputJsonValue
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ELEARNING_TEST_STARTED",
      entityType: "SsmTrainingTestAttempt",
      entityId: attempt.id
    });
    return {
      attemptId: attempt.id,
      questions,
      passThresholdPercent: SSM_TRAINING_PASS_THRESHOLD_PERCENT
    };
  }

  async completeTest(tenantId: string, actorId: string, dto: CompleteTestDto, viewer: JwtPayload) {
    await this.assertTrainingPlanVisibleToViewer(tenantId, dto.trainingPlanId, viewer);
    const plan = await (this.prisma as PrismaWithTrainingPlanLegal).ssmTrainingPlan.findFirst({
      where: { id: dto.trainingPlanId, tenantId },
      include: {
        trainingType: {
          select: {
            legalMinDurationHours: true,
            name: true,
            category: true,
            testQuestionsJson: true
          }
        },
        attempts: {
          orderBy: { startedAt: "desc" },
          take: 1
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    this.assertTrainingPlanActiveForWorkflow(plan);
    this.assertMaterialReady(plan);
    if (!plan.attempts.length) {
      throw new BadRequestException("Nu există o tentativă de test pornită.");
    }
    const latestAttempt = plan.attempts[0];
    if (latestAttempt.finishedAt) {
      throw new BadRequestException("Testul a fost deja trimis.");
    }
    const meta = this.parseAttemptMeta(latestAttempt.answersJson);
    if (!meta) {
      throw new BadRequestException("Datele testului nu sunt valide. Reporniți testul.");
    }

    const bank = resolveTrainingTestQuestionsFromType(
      plan.trainingType.category as SsmTrainingCategoryCode,
      plan.trainingType.testQuestionsJson
    );
    const grade = gradeTrainingTestAnswers(meta, dto.answers, bank);
    const now = new Date();

    if (grade.passed && plan.trainingType.legalMinDurationHours) {
      const minimumSeconds = plan.trainingType.legalMinDurationHours * 60 * 60;
      if (dto.durationSeconds < minimumSeconds) {
        throw new BadRequestException(
          `Durata minimă legală pentru ${plan.trainingType.name} este ${plan.trainingType.legalMinDurationHours} ore.`
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ssmTrainingTestAttempt.update({
        where: { id: latestAttempt.id },
        data: {
          finishedAt: now,
          score: grade.score,
          durationSeconds: dto.durationSeconds,
          passed: grade.passed,
          answersJson: {
            __meta__: meta,
            answers: dto.answers,
            grade
          } as unknown as Prisma.InputJsonValue
        }
      });
      await tx.ssmTrainingPlan.update({
        where: { id: plan.id },
        data: {
          completedAt: null,
          score: grade.score,
          durationMinutes: Math.ceil(dto.durationSeconds / 60),
          status: grade.passed ? SsmTrainingPlanStatus.PENDING : SsmTrainingPlanStatus.BLOCKED,
          blockedAdmission: !grade.passed
        }
      });
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "ELEARNING_TEST_COMPLETED",
      entityType: "SsmTrainingPlan",
      entityId: plan.id,
      payload: { score: grade.score, passed: grade.passed, correctCount: grade.correctCount, totalCount: grade.totalCount }
    });

    return {
      trainingPlanId: plan.id,
      passed: grade.passed,
      score: grade.score,
      correctCount: grade.correctCount,
      totalCount: grade.totalCount,
      passThresholdPercent: SSM_TRAINING_PASS_THRESHOLD_PERCENT
    };
  }

  private async scheduleNextRecurrenceIfNeeded(tenantId: string, actorId: string, completedPlanId: string) {
    const completed = await this.prisma.ssmTrainingPlan.findFirst({
      where: { id: completedPlanId, tenantId, status: SsmTrainingPlanStatus.COMPLETED },
      include: { trainingType: { select: { id: true, recurrenceDays: true, name: true } } }
    });
    if (!completed?.completedAt || !completed.trainingType.recurrenceDays) {
      return;
    }
    const existingOpen = await this.prisma.ssmTrainingPlan.findFirst({
      where: {
        tenantId,
        employeeId: completed.employeeId,
        trainingTypeId: completed.trainingTypeId,
        status: { in: [SsmTrainingPlanStatus.PENDING, SsmTrainingPlanStatus.OVERDUE] }
      }
    });
    if (existingOpen) {
      return;
    }
    const scheduledAt = new Date(completed.completedAt);
    const dueAt = new Date(scheduledAt.getTime() + completed.trainingType.recurrenceDays * 24 * 60 * 60 * 1000);
    await this.prisma.ssmTrainingPlan.create({
      data: {
        tenantId,
        employeeId: completed.employeeId,
        trainingTypeId: completed.trainingTypeId,
        scheduledAt,
        dueAt,
        materialTitle: `Recurență: ${completed.trainingType.name}`,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "TRAINING_RECURRENCE_SCHEDULED",
      entityType: "SsmTrainingPlan",
      entityId: completedPlanId,
      payload: { nextDueAt: dueAt.toISOString() }
    });
  }

  async signTrainingPlan(
    tenantId: string,
    actorId: string,
    trainingPlanId: string,
    dto: SignPlanDto,
    viewer: JwtPayload
  ) {
    const plan = await this.prisma.ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      include: {
        signature: true,
        trainingType: { select: { category: true } },
        employee: { select: { departmentId: true, worksiteId: true } },
        attempts: {
          where: { finishedAt: { not: null } },
          orderBy: { finishedAt: "desc" },
          take: 1
        }
      }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    const passedAttempt = plan.attempts.find((attempt) => attempt.passed === true);
    if (!passedAttempt) {
      throw new BadRequestException("Semnarea necesită un test trecut cu succes.");
    }
    const needsManager = plan.trainingType.category === SsmTrainingCategory.WORKPLACE;

    if (dto.role === "EMPLOYEE") {
      if (!hasAllPermissions(viewer.roles, [Permission.SSM_TRAINING_EDIT])) {
        throw new ForbiddenException("Semnătura angajatului necesită dreptul de parcurgere/finalizare instruire.");
      }
      const selfId = await findEmployeeIdForUserEmail(this.prisma, tenantId, viewer.email);
      if (!selfId || selfId !== plan.employeeId) {
        throw new ForbiddenException("Semnătura angajatului este permisă doar pentru propriul plan de instruire.");
      }
      if (plan.signature?.employeeSignedAt) {
        throw new BadRequestException("Angajatul a semnat deja această instruire.");
      }
    } else if (dto.role === "MANAGER") {
      const isManager = (viewer.roles ?? []).some((role) =>
        [SystemRole.DEPARTMENT_MANAGER, SystemRole.SSM_ADMIN, SystemRole.SSM_ENTITY_RESPONSIBLE].includes(role as SystemRole)
      );
      if (!isManager) {
        throw new ForbiddenException("Semnătura managerului necesită rol de manager departament sau responsabil SSM.");
      }
      if (!needsManager) {
        throw new BadRequestException("Această instruire nu necesită aprobarea managerului.");
      }
      if (!plan.signature?.employeeSignedAt) {
        throw new BadRequestException("Instruirea trebuie semnată mai întâi de angajat.");
      }
      if (plan.signature?.managerSignedAt) {
        throw new BadRequestException("Managerul a aprobat deja această instruire.");
      }
      const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
      await assertSsmEmployeeAccess(this.prisma, tenantId, plan.employeeId, scope);
    } else {
      if (!hasAllPermissions(viewer.roles, [Permission.SSM_TRAINING_APPROVE])) {
        throw new ForbiddenException("Semnătura responsabilului necesită dreptul de aprobare instruire.");
      }
      if (!plan.signature?.employeeSignedAt) {
        throw new BadRequestException("Instruirea trebuie semnată mai întâi de angajat.");
      }
      if (needsManager && !plan.signature?.managerSignedAt) {
        throw new BadRequestException("Instruirea la locul de muncă necesită aprobarea managerului înainte de validarea SSM.");
      }
      if (plan.signature?.responsibleSignedAt) {
        throw new BadRequestException("Responsabilul SSM a validat deja această instruire.");
      }
    }
    const now = new Date();
    const signature = await this.prisma.ssmTrainingSignature.upsert({
      where: { trainingPlanId },
      create: {
        tenantId,
        trainingPlanId,
        ...(dto.role === "EMPLOYEE"
          ? { employeeSignature: dto.signatureData, employeeSignedAt: now }
          : dto.role === "MANAGER"
            ? { managerSignature: dto.signatureData, managerSignedAt: now, managerUserId: actorId }
            : { responsibleSignature: dto.signatureData, responsibleSignedAt: now })
      },
      update:
        dto.role === "EMPLOYEE"
          ? { employeeSignature: dto.signatureData, employeeSignedAt: now }
          : dto.role === "MANAGER"
            ? { managerSignature: dto.signatureData, managerSignedAt: now, managerUserId: actorId }
            : { responsibleSignature: dto.signatureData, responsibleSignedAt: now }
    });

    if (dto.role === "RESPONSIBLE") {
      await this.prisma.ssmTrainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          status: SsmTrainingPlanStatus.COMPLETED,
          completedAt: now,
          blockedAdmission: false
        }
      });
      await this.scheduleNextRecurrenceIfNeeded(tenantId, actorId, trainingPlanId);
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "TRAINING_PLAN_SIGNED",
      entityType: "SsmTrainingPlan",
      entityId: trainingPlanId,
      payload: { role: dto.role }
    });

    return signature;
  }

  async signPlansBatch(tenantId: string, actorId: string, dto: SignPlansBatchDto, viewer: JwtPayload) {
    const uniquePlanIds = Array.from(new Set(dto.planIds));
    if (!uniquePlanIds.length) {
      throw new BadRequestException("planIds is empty.");
    }
    let signedCount = 0;
    for (const planId of uniquePlanIds) {
      try {
        await this.signTrainingPlan(tenantId, actorId, planId, {
          role: dto.role,
          signatureData: dto.signatureData
        }, viewer);
        signedCount += 1;
      } catch {
        // continue with remaining plans
      }
    }
    return {
      requested: uniquePlanIds.length,
      signed: signedCount,
      skipped: uniquePlanIds.length - signedCount
    };
  }

  async listPlans(
    tenantId: string,
    viewer: JwtPayload,
    query?: import("../../../../common/dto/pagination-query.dto").PaginationQueryDto
  ) {
    const { resolvePagination } = await import("../../../../common/dto/pagination-query.dto");
    const { paginatedResult } = await import("../../../../common/pagination");
    await this.syncOverdue(tenantId);
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "empty") {
      return paginatedResult([], 0, 1, resolvePagination(query).pageSize);
    }
    const p = resolvePagination(query);
    const where = ssmTrainingPlanWhere(tenantId, scope);
    const [rows, total] = await Promise.all([
      this.prisma.ssmTrainingPlan.findMany({
        where,
        include: {
          employee: { select: { fullName: true } },
          trainingType: { select: { code: true, name: true, category: true } },
          signature: {
            select: {
              employeeSignedAt: true,
              managerSignedAt: true,
              responsibleSignedAt: true
            }
          }
        },
        orderBy: [{ dueAt: "asc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.ssmTrainingPlan.count({ where })
    ]);
    const items = rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        trainingTypeId: row.trainingTypeId,
        trainingTypeCode: row.trainingType.code,
        trainingTypeName: row.trainingType.name,
        trainingTypeCategory: row.trainingType.category,
        employeeName: row.employee.fullName,
        scheduledAt: row.scheduledAt,
        dueAt: row.dueAt,
        completedAt: row.completedAt,
        materialTitle: row.materialTitle,
        materialUrl: row.materialUrl,
        materialStartedAt: row.materialStartedAt,
        materialCompletedAt: row.materialCompletedAt,
        materialTimeSpentSeconds: row.materialTimeSpentSeconds,
        score: row.score,
        durationMinutes: row.durationMinutes,
        status: row.status,
        blockedAdmission: row.blockedAdmission,
        employeeSignedAt: row.signature?.employeeSignedAt?.toISOString() ?? null,
        managerSignedAt: row.signature?.managerSignedAt?.toISOString() ?? null,
        responsibleSignedAt: row.signature?.responsibleSignedAt?.toISOString() ?? null
      }));
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  private async trainingReminders(
    tenantId: string,
    filter?: { employeeId?: string; worksiteIds?: string[] }
  ) {
    await this.syncOverdue(tenantId);
    const rows = await this.prisma.ssmTrainingPlan.findMany({
      where: {
        tenantId,
        ...(filter?.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter?.worksiteIds?.length
          ? { employee: { worksiteId: { in: filter.worksiteIds } } }
          : {}),
        status: { in: [SsmTrainingPlanStatus.PENDING, SsmTrainingPlanStatus.OVERDUE] }
      },
      include: {
        employee: { select: { fullName: true, email: true } },
        trainingType: { select: { name: true, reminderDays: true } }
      }
    });
    const now = new Date();
    return rows
      .map((row) => {
        const daysUntilDue = daysDiff(now, row.dueAt);
        const reminderDays = row.trainingType.reminderDays?.length
          ? row.trainingType.reminderDays
          : DEFAULT_REMINDER_DAYS;
        return {
          trainingPlanId: row.id,
          employeeName: row.employee.fullName,
          employeeEmail: row.employee.email,
          trainingTypeName: row.trainingType.name,
          dueAt: row.dueAt,
          daysUntilDue,
          reminderDays
        };
      })
      .filter((item) => item.reminderDays.includes(item.daysUntilDue) || item.daysUntilDue < 0)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  async remindersPreview(tenantId: string, viewer: JwtPayload) {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "empty") {
      return { reminders: [] };
    }
    const filter =
      scope.mode === "self"
        ? { employeeId: scope.employeeId }
        : scope.mode === "worksite"
          ? { worksiteIds: [scope.worksiteId] }
          : scope.mode === "worksites"
            ? { worksiteIds: scope.worksiteIds }
            : undefined;
    const reminders = await this.trainingReminders(tenantId, filter);
    return {
      reminders: reminders.map(({ employeeEmail: _ignored, ...item }) => item)
    };
  }

  async dispatchReminders(tenantId: string, actorId: string) {
    const reminders = await this.trainingReminders(tenantId);
    const dispatchRepo = (this.prisma as PrismaWithReminderDispatch).ssmTrainingReminderDispatch;
    let sentEmail = 0;
    let sentInApp = 0;
    for (const reminder of reminders) {
      const reminderText =
        reminder.daysUntilDue < 0
          ? `Instruirea ${reminder.trainingTypeName} este restantă cu ${Math.abs(reminder.daysUntilDue)} zile.`
          : `Instruirea ${reminder.trainingTypeName} expiră în ${reminder.daysUntilDue} zile.`;

      const emailSent = await dispatchRepo.findUnique({
        where: {
          trainingPlanId_daysUntilDue_channel: {
            trainingPlanId: reminder.trainingPlanId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "email"
          }
        }
      });
      if (!emailSent && reminder.employeeEmail) {
        await this.mailService.sendMail({
          to: reminder.employeeEmail,
          subject: `Reminder instruire SSM: ${reminder.trainingTypeName}`,
          text: reminderText
        });
        await dispatchRepo.create({
          data: {
            tenantId,
            trainingPlanId: reminder.trainingPlanId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "email"
          }
        });
        sentEmail += 1;
      }

      const inAppSent = await dispatchRepo.findUnique({
        where: {
          trainingPlanId_daysUntilDue_channel: {
            trainingPlanId: reminder.trainingPlanId,
            daysUntilDue: reminder.daysUntilDue,
            channel: "in_app"
          }
        }
      });
      if (!inAppSent) {
        const plan = await this.prisma.ssmTrainingPlan.findFirst({
          where: { id: reminder.trainingPlanId, tenantId },
          select: { employeeId: true }
        });
        if (plan) {
          await this.notifications.notifyEmployee({
            tenantId,
            employeeId: plan.employeeId,
            category: "TRAINING_REMINDER",
            title: `Reminder instruire: ${reminder.trainingTypeName}`,
            body: reminderText,
            linkPath: "/portal?tab=trainings",
            entityType: "SsmTrainingPlan",
            entityId: reminder.trainingPlanId
          });
          await dispatchRepo.create({
            data: {
              tenantId,
              trainingPlanId: reminder.trainingPlanId,
              daysUntilDue: reminder.daysUntilDue,
              channel: "in_app"
            }
          });
          sentInApp += 1;
        }
      }
    }
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "TRAINING_REMINDERS_DISPATCHED",
      entityType: "SsmTrainingReminderDispatch",
      entityId: "-",
      payload: { sentEmail, sentInApp }
    });
    return { sent: sentEmail + sentInApp, sentEmail, sentInApp };
  }

  async calendar(tenantId: string, viewer: JwtPayload) {
    await this.syncOverdue(tenantId);
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "empty") {
      return { events: [] };
    }
    const plans = await this.prisma.ssmTrainingPlan.findMany({
      where: ssmTrainingPlanWhere(tenantId, scope),
      include: {
        employee: { select: { fullName: true } },
        trainingType: { select: { name: true } }
      },
      orderBy: [{ scheduledAt: "asc" }]
    });
    return {
      events: plans.map((plan) => ({
        id: plan.id,
        title: `${plan.trainingType.name} - ${plan.employee.fullName}`,
        scheduledAt: plan.scheduledAt,
        dueAt: plan.dueAt,
        status: plan.status,
        employeeName: plan.employee.fullName,
        trainingTypeName: plan.trainingType.name
      }))
    };
  }

  async complianceReport(tenantId: string, viewer: JwtPayload) {
    await this.syncOverdue(tenantId);
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "empty") {
      return {
        items: [],
        byDepartment: [],
        summary: { employeeCount: 0, compliantPercent: 100, blockedAdmissionCount: 0 }
      };
    }
    const employees = await this.prisma.employee.findMany({
      where: ssmEmployeeWhere(tenantId, scope),
      select: {
        id: true,
        fullName: true,
        departmentId: true,
        department: { select: { name: true } },
        ssmTrainingPlans: {
          select: {
            status: true
          }
        }
      },
      orderBy: { fullName: "asc" }
    });

    const items = employees.map((employee) => {
      const completed = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.COMPLETED).length;
      const overdue = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.OVERDUE).length;
      const blocked = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.BLOCKED).length;
      const pending = employee.ssmTrainingPlans.filter((p) => p.status === SsmTrainingPlanStatus.PENDING).length;
      const total = employee.ssmTrainingPlans.length;
      const complianceScore = total ? Math.round((completed / total) * 100) : 100;
      return {
        employeeId: employee.id,
        employeeName: employee.fullName,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name ?? "Fără departament",
        completed,
        pending,
        overdue,
        complianceScore,
        blockedAdmission: overdue > 0 || blocked > 0
      };
    });

    const departmentMap = new Map<
      string,
      { departmentId: string | null; departmentName: string; employees: typeof items }
    >();
    for (const item of items) {
      const key = item.departmentId ?? "__none__";
      const existing = departmentMap.get(key);
      if (existing) {
        existing.employees.push(item);
      } else {
        departmentMap.set(key, {
          departmentId: item.departmentId,
          departmentName: item.departmentName,
          employees: [item]
        });
      }
    }

    const byDepartment = Array.from(departmentMap.values()).map((group) => {
      const employeeCount = group.employees.length;
    const compliantCount = group.employees.filter((e) => e.complianceScore >= 100 && !e.blockedAdmission).length;
      const blockedCount = group.employees.filter((e) => e.blockedAdmission).length;
      const complianceScore = employeeCount
        ? Math.round(
            group.employees.reduce((sum, e) => sum + e.complianceScore, 0) / employeeCount
          )
        : 100;
      return {
        departmentId: group.departmentId,
        departmentName: group.departmentName,
        employeeCount,
        compliantCount,
        complianceScore,
        blockedCount
      };
    });

    const employeeCount = items.length;
    const compliantPercent = employeeCount
      ? Math.round((items.filter((e) => !e.blockedAdmission && e.complianceScore >= 100).length / employeeCount) * 100)
      : 100;
    const blockedAdmissionCount = items.filter((e) => e.blockedAdmission).length;

    return {
      items: items.map(({ departmentId: _d, departmentName: _n, ...rest }) => rest),
      byDepartment,
      summary: {
        employeeCount,
        compliantPercent,
        blockedAdmissionCount
      }
    };
  }

  async digitalFile(tenantId: string, employeeId: string, viewer: JwtPayload) {
    await this.assertDigitalFileEmployeeAccess(tenantId, employeeId, viewer);
    await this.syncOverdue(tenantId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        department: true,
        jobPosition: true,
        worksite: true
      }
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const trainings = await this.prisma.ssmTrainingPlan.findMany({
      where: { tenantId, employeeId },
      include: { trainingType: true },
      orderBy: { dueAt: "desc" }
    });
    const documents = await this.prisma.ssmDocument.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        OR: [
          { targetType: "ALL" },
          {
            targetType: "DEPARTMENT",
            targetLabel: employee.department?.name ?? undefined
          },
          {
            targetType: "JOB_POSITION",
            targetLabel: employee.jobPosition?.name ?? undefined
          },
          {
            targetType: "WORKSITE",
            targetLabel: employee.worksite?.name ?? undefined
          }
        ]
      },
      include: {
        activeVersion: true
      },
      orderBy: { updatedAt: "desc" }
    });
    const medicalControls = await (this.prisma as PrismaWithMedicalControl).ssmMedicalControl.findMany({
      where: { tenantId, employeeId },
      include: {
        controlType: {
          select: {
            name: true
          }
        }
      },
      orderBy: { scheduledAt: "desc" }
    });
    const eipMovements = await this.prisma.ssmEipMovement.findMany({
      where: { tenantId, employeeId },
      include: { eipType: { select: { name: true, code: true } } },
      orderBy: { movementDate: "desc" }
    });
    const riskExposureSheets = documents.filter((doc) => doc.type === "RISK_ASSESSMENT");
    const eipDecisionCopies = documents.filter((doc) => doc.type === "DECISION");

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        department: employee.department?.name,
        jobPosition: employee.jobPosition?.name,
        worksite: employee.worksite?.name
      },
      trainings: trainings.map((t) => ({
        id: t.id,
        type: t.trainingType.name,
        dueAt: t.dueAt,
        completedAt: t.completedAt,
        status: t.status,
        score: t.score
      })),
      documents: documents
        .filter((doc) => doc.activeVersion)
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          fileName: doc.activeVersion?.fileName,
          updatedAt: doc.updatedAt
        })),
      riskExposureSheets: riskExposureSheets.map((doc) => ({
        id: doc.id,
        title: doc.title,
        fileName: doc.activeVersion?.fileName
      })),
      eipDecisionCopies: eipDecisionCopies.map((doc) => ({
        id: doc.id,
        title: doc.title,
        fileName: doc.activeVersion?.fileName
      })),
      medicalControls: medicalControls.map((control: MedicalControlForDossier) => ({
        id: control.id,
        controlType: control.controlType.name,
        scheduledAt: control.scheduledAt,
        performedAt: control.performedAt,
        nextDueAt: control.nextDueAt,
        result: control.result,
        aptitudeSheetName: control.aptitudeSheetName
      })),
      eipRecords: eipMovements.map((movement) => ({
        id: movement.id,
        eipName: movement.eipType.name,
        eipCode: movement.eipType.code,
        movementType: movement.movementType,
        movementDate: movement.movementDate,
        replacementDueAt: movement.replacementDueAt,
        signedAt: movement.signedAt
      }))
    };
  }

  async exportDigitalFileZip(tenantId: string, employeeId: string, viewer: JwtPayload) {
    const dossier = await this.digitalFile(tenantId, employeeId, viewer);
    const zip = new JSZip();
    zip.file("dossier.json", JSON.stringify(dossier, null, 2));

    const docs = await this.prisma.ssmDocument.findMany({
      where: {
        tenantId,
        status: "ACTIVE"
      },
      include: { activeVersion: true },
      take: 20
    });

    for (const doc of docs) {
      const version = doc.activeVersion;
      if (!version?.storagePath) continue;
      try {
        const fileBuffer = await readFile(version.storagePath);
        zip.file(`documents/${doc.title}-${version.versionNumber}-${version.fileName}`, fileBuffer);
      } catch {
        // staged export: skip files that are unavailable on disk
      }
    }

    return zip.generateAsync({ type: "nodebuffer" });
  }

  async generateIndividualSheetPdf(tenantId: string, trainingPlanId: string, viewer: JwtPayload) {
    await this.assertTrainingPlanVisibleToViewer(tenantId, trainingPlanId, viewer);
    const plan = await this.prisma.ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      include: {
        employee: true,
        trainingType: true,
        signature: true
      }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("FIȘA INDIVIDUALĂ DE INSTRUIRE SSM/PSI", { align: "center" });
      doc.moveDown();
      doc.fontSize(11);
      doc.text("Unitatea: conform evidenței angajatului");
      doc.text(`Nume și prenume: ${plan.employee.fullName}`);
      doc.text(`Funcție: ${plan.employee.jobPositionId ? "conform fișă post" : "-"}`);
      doc.text(`Tip instruire: ${plan.trainingType.name}`);
      doc.text(`Cod tematică: ${plan.trainingType.code}`);
      doc.text(`Data programării: ${plan.scheduledAt.toLocaleDateString("ro-RO")}`);
      doc.text(`Data limită: ${plan.dueAt.toLocaleDateString("ro-RO")}`);
      doc.text(`Durată parcurgere (min): ${plan.durationMinutes ?? "-"}`);
      doc.text(`Rezultat test verificare: ${plan.score != null ? `${plan.score}%` : "—"}`);
      doc.moveDown();
      doc.text(
        `Semnătură angajat: ${
          plan.signature?.employeeSignedAt
            ? `da (${plan.signature.employeeSignedAt.toLocaleDateString("ro-RO")})`
            : "nu"
        }`
      );
      doc.text(
        `Semnătură responsabil SSM: ${
          plan.signature?.responsibleSignedAt
            ? `da (${plan.signature.responsibleSignedAt.toLocaleDateString("ro-RO")})`
            : "nu"
        }`
      );
      doc.moveDown();
      doc.fontSize(9).text("Document generat electronic — păstrare conform legislației muncii.");
      doc.end();
    });

    return buffer;
  }

  private async assertTrainingPlanVisibleToViewer(
    tenantId: string,
    trainingPlanId: string,
    viewer: JwtPayload
  ): Promise<void> {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "tenant") {
      return;
    }
    if (scope.mode === "empty") {
      throw new ForbiddenException("Contul nu este asociat unui angajat pentru acces SSM individual.");
    }
    const plan = await this.prisma.ssmTrainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      select: { employeeId: true }
    });
    if (!plan) {
      throw new NotFoundException("Training plan not found.");
    }
    await assertSsmEmployeeAccess(this.prisma, tenantId, plan.employeeId, scope);
  }

  private async assertDigitalFileEmployeeAccess(
    tenantId: string,
    employeeId: string,
    viewer: JwtPayload
  ): Promise<void> {
    const scope = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (scope.mode === "tenant") {
      return;
    }
    if (scope.mode === "empty") {
      throw new ForbiddenException("Contul nu este asociat unui angajat pentru acces SSM individual.");
    }
    await assertSsmEmployeeAccess(this.prisma, tenantId, employeeId, scope);
  }

  async generateCollectiveSheetPdf(dto: GenerateCollectiveSheetDto) {
    const createdAt = new Date();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("Fișă colectivă de instructaj", { align: "center" });
      doc.moveDown(0.6);
      doc.fontSize(12).text(`Tematică: ${dto.title}`);
      doc.text(`Instructor: ${dto.trainerName ?? "-"}`);
      doc.text(`Locație: ${dto.location ?? "-"}`);
      doc.text(`Data: ${createdAt.toISOString()}`);
      doc.moveDown();
      doc.text("Participanți:");
      dto.attendees.forEach((name, index) => {
        doc.text(`${index + 1}. ${name}`);
      });
      doc.moveDown();
      doc.fontSize(10).text("Document generat automat pentru vizitatori/colaboratori.");
      doc.end();
    });
    return buffer;
  }
}
