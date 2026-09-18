import { readFile } from "fs/promises";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import JSZip from "jszip";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../logging/audit-log.service";
import { DataEncryptionService } from "../security/data-encryption.service";
import { decryptStoredCnp } from "../../modules/ssm/application/legal-forms/pdf-form-kit";
import * as bcrypt from "bcrypt";

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (current instanceof Date) return current.toISOString();
      return current;
    })
  );
}

async function zipFileIfExists(zip: JSZip, zipPath: string, diskPath?: string | null) {
  if (!diskPath) return false;
  try {
    const buffer = await readFile(diskPath);
    zip.file(zipPath, buffer);
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class DsarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly encryption: DataEncryptionService
  ) {}

  async exportZip(tenantId: string, actorId: string, employeeId: string): Promise<Buffer> {
    const pack = await this.collectSubject(tenantId, employeeId);
    const zip = new JSZip();
    zip.file(
      "README.txt",
      [
        "Export DSAR (Art. 15 GDPR) — date personale din platforma internă.",
        `Persoană: ${pack.employee.fullName} <${pack.employee.email}>`,
        `Generat: ${new Date().toISOString()}`,
        "",
        "Conținut:",
        "- persoana.json, cont.json — identitate și cont de acces",
        "- instruiri, medical, eip, accidente, tichete, sondaje, comunicări",
        "- fisiere/ — copii ale fișelor atașate (aptitudini, probe accidente), dacă există pe disc",
        "",
        "Parolele și secretele de autentificare nu sunt incluse."
      ].join("\n")
    );
    zip.file("persoana.json", JSON.stringify(pack.employee, null, 2));
    zip.file("cont.json", JSON.stringify(pack.user, null, 2));
    zip.file("plasamente.json", JSON.stringify(pack.placements, null, 2));
    zip.file("instruiri.json", JSON.stringify(pack.trainings, null, 2));
    zip.file("medical.json", JSON.stringify(pack.medical, null, 2));
    zip.file("eip.json", JSON.stringify(pack.eip, null, 2));
    zip.file("accidente.json", JSON.stringify(pack.accidents, null, 2));
    zip.file("tichete.json", JSON.stringify(pack.tickets, null, 2));
    zip.file("sondaje.json", JSON.stringify(pack.surveys, null, 2));
    zip.file("comunicari.json", JSON.stringify(pack.communications, null, 2));
    zip.file("notificari.json", JSON.stringify(pack.notifications, null, 2));
    zip.file("audit.json", JSON.stringify(pack.audit, null, 2));

    for (const control of pack.medical) {
      await zipFileIfExists(
        zip,
        `fisiere/medical/${control.id}-${control.aptitudeSheetName ?? "fisa"}`,
        control.aptitudeSheetPath
      );
    }
    for (const attachment of pack.accidentFiles) {
      await zipFileIfExists(zip, `fisiere/accidente/${attachment.fileName}`, attachment.storagePath);
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "GDPR",
      action: "DSAR_EXPORT",
      entityType: "Employee",
      entityId: employeeId,
      payload: { email: pack.employee.email, files: true }
    });

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  async erase(
    tenantId: string,
    actorId: string,
    actorEmail: string | undefined,
    employeeId: string,
    confirmEmail: string
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId }
    });
    if (!employee) throw new NotFoundException("Angajatul nu a fost găsit.");
    if (employee.dsarErasedAt) {
      throw new BadRequestException("Datele acestei persoane au fost deja anonimizate.");
    }
    if (employee.email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      throw new BadRequestException("Confirmarea trebuie să fie adresa de e-mail actuală a persoanei.");
    }
    if (actorEmail && actorEmail.trim().toLowerCase() === employee.email.trim().toLowerCase()) {
      throw new ForbiddenException("Nu poți anonimiza propriul cont. Cere unui alt administrator.");
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: employee.email } }
    });
    if (user?.id === actorId) {
      throw new ForbiddenException("Nu poți anonimiza propriul cont. Cere unui alt administrator.");
    }

    const suffix = employee.id.slice(-8);
    const erasedEmployeeEmail = `erased-${employee.id}@anonymized.invalid`;
    const erasedUserEmail = user ? `erased-user-${user.id}@anonymized.invalid` : null;
    const erasedName = `Persoană ștearsă ${suffix}`;
    const now = new Date();
    const dummyHash = await bcrypt.hash(`erased-${employee.id}-${Date.now()}`, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          fullName: erasedName,
          email: erasedEmployeeEmail,
          cnp: null,
          bloodGroup: null,
          domicile: null,
          commuteRoute: null,
          iscirAuthorizations: null,
          maritalStatus: null,
          active: false,
          leaveDate: employee.leaveDate ?? now,
          dsarErasedAt: now
        }
      });

      await tx.employeeGroupMember.deleteMany({ where: { employeeId: employee.id } });

      await tx.helpdeskTicket.updateMany({
        where: { tenantId, reporterEmployeeId: employee.id },
        data: {
          reporterName: erasedName,
          reporterEmail: erasedEmployeeEmail
        }
      });

      await tx.surveyResponse.updateMany({
        where: { tenantId, employeeId: employee.id },
        data: {
          employeeId: null,
          respondentUserId: null,
          ipHash: null,
          userAgent: null
        }
      });

      if (user) {
        await tx.passwordResetToken.deleteMany({ where: { tenantId, userId: user.id } });
        await tx.pushSubscription.deleteMany({ where: { tenantId, userId: user.id } });
        await tx.inAppNotification.deleteMany({ where: { tenantId, userId: user.id } });
        await tx.userScopedRole.deleteMany({ where: { tenantId, userId: user.id } });
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: erasedUserEmail!,
            fullName: erasedName,
            active: false,
            passwordHash: dummyHash,
            externalId: null,
            authProvider: "LOCAL",
            itmAccessExpiresAt: null
          }
        });
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "GDPR",
      action: "DSAR_ERASE",
      entityType: "Employee",
      entityId: employee.id,
      payload: {
        previousEmail: employee.email,
        retained: [
          "instruiri SSM",
          "controale medicale",
          "EIP",
          "accidente",
          "jurnal audit"
        ],
        note: "Identitatea a fost anonimizată. Evidențele SSM obligatorii legal au fost păstrate fără date de contact."
      }
    });

    return {
      ok: true as const,
      employeeId: employee.id,
      anonymizedAt: now.toISOString(),
      retainedCategories: ["instruiri SSM", "medicina muncii", "EIP", "accidente", "audit"]
    };
  }

  private async collectSubject(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        worksite: { select: { code: true, name: true } },
        department: { select: { code: true, name: true } },
        jobPosition: { select: { code: true, name: true, corCode: true } }
      }
    });
    if (!employee) throw new NotFoundException("Angajatul nu a fost găsit.");

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: employee.email } },
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        roles: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const [
      placements,
      trainings,
      medical,
      eip,
      accidents,
      tickets,
      surveys,
      reads,
      reactions,
      answers,
      notifications,
      audit
    ] = await Promise.all([
      this.prisma.employeePlacementHistory.findMany({
        where: { tenantId, employeeId },
        orderBy: { effectiveFrom: "desc" }
      }),
      this.prisma.ssmTrainingPlan.findMany({
        where: { tenantId, employeeId },
        include: { trainingType: { select: { code: true, name: true, category: true } } },
        orderBy: { dueAt: "desc" }
      }),
      this.prisma.ssmMedicalControl.findMany({
        where: { tenantId, employeeId },
        include: { controlType: { select: { code: true, name: true, category: true } } },
        orderBy: { scheduledAt: "desc" }
      }),
      this.prisma.ssmEipMovement.findMany({
        where: { tenantId, employeeId },
        include: { eipType: { select: { code: true, name: true } } },
        orderBy: { movementDate: "desc" }
      }),
      this.prisma.ssmAccidentCase.findMany({
        where: { tenantId, employeeId },
        include: { attachments: true },
        orderBy: { occurredAt: "desc" }
      }),
      this.prisma.helpdeskTicket.findMany({
        where: { tenantId, reporterEmployeeId: employeeId },
        include: { comments: { select: { body: true, internal: true, createdAt: true, createdBy: true } } },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.surveyResponse.findMany({
        where: { tenantId, OR: [{ employeeId }, ...(user ? [{ respondentUserId: user.id }] : [])] },
        include: { survey: { select: { title: true, anonymousMode: true } } },
        orderBy: { submittedAt: "desc" }
      }),
      this.prisma.communicationAnnouncementRead.findMany({
        where: { tenantId, employeeId },
        include: { announcement: { select: { title: true } } }
      }),
      this.prisma.communicationAnnouncementReaction.findMany({
        where: { tenantId, employeeId },
        include: { announcement: { select: { title: true } } }
      }),
      this.prisma.communicationAnnouncementAnswer.findMany({
        where: { tenantId, employeeId },
        include: { announcement: { select: { title: true } } }
      }),
      user
        ? this.prisma.inAppNotification.findMany({
            where: { tenantId, userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 500
          })
        : Promise.resolve([]),
      user
        ? this.prisma.auditLog.findMany({
            where: { tenantId, actorId: user.id },
            orderBy: { createdAt: "desc" },
            take: 1000
          })
        : Promise.resolve([])
    ]);

    const cnp = decryptStoredCnp((payload) => this.encryption.decrypt(payload), employee.cnp);

    return {
      employee: jsonSafe({
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        cnp: cnp || null,
        active: employee.active,
        hireDate: employee.hireDate,
        leaveDate: employee.leaveDate,
        bloodGroup: employee.bloodGroup,
        domicile: employee.domicile,
        commuteRoute: employee.commuteRoute,
        iscirAuthorizations: employee.iscirAuthorizations,
        maritalStatus: employee.maritalStatus,
        worksite: employee.worksite,
        department: employee.department,
        jobPosition: employee.jobPosition,
        dsarErasedAt: employee.dsarErasedAt
      }) as Record<string, unknown> & { fullName: string; email: string },
      user: jsonSafe(user),
      placements: jsonSafe(placements),
      trainings: jsonSafe(
        trainings.map((row) => ({
          id: row.id,
          type: row.trainingType.name,
          category: row.trainingType.category,
          status: row.status,
          scheduledAt: row.scheduledAt,
          dueAt: row.dueAt,
          completedAt: row.completedAt,
          score: row.score
        }))
      ),
      medical: medical.map((row) => ({
        id: row.id,
        controlType: row.controlType.name,
        category: row.controlType.category,
        scheduledAt: row.scheduledAt.toISOString(),
        performedAt: row.performedAt?.toISOString() ?? null,
        result: row.result,
        recommendations: row.recommendations,
        nextDueAt: row.nextDueAt?.toISOString() ?? null,
        aptitudeSheetName: row.aptitudeSheetName,
        aptitudeSheetPath: row.aptitudeSheetPath
      })),
      eip: jsonSafe(
        eip.map((row) => ({
          id: row.id,
          type: row.eipType.name,
          movementType: row.movementType,
          quantity: row.quantity,
          movementDate: row.movementDate,
          replacementDueAt: row.replacementDueAt
        }))
      ),
      accidents: jsonSafe(
        accidents.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          occurredAt: row.occurredAt,
          location: row.location,
          status: row.status,
          attachments: row.attachments.map((item) => ({
            id: item.id,
            fileName: item.fileName,
            kind: item.kind
          }))
        }))
      ),
      accidentFiles: accidents.flatMap((row) =>
        row.attachments.map((item) => ({ fileName: item.fileName, storagePath: item.storagePath }))
      ),
      tickets: jsonSafe(tickets),
      surveys: jsonSafe(
        surveys.map((row) => ({
          surveyTitle: row.survey.title,
          anonymousMode: row.survey.anonymousMode,
          submittedAt: row.submittedAt,
          answers: row.survey.anonymousMode ? "[anonimizat în sondaj]" : row.answersJson
        }))
      ),
      communications: jsonSafe({
        reads: reads.map((row) => ({ title: row.announcement.title, readAt: row.readAt })),
        reactions: reactions.map((row) => ({ title: row.announcement.title, reaction: row.reaction })),
        answers: answers.map((row) => ({ title: row.announcement.title, answerText: row.answerText }))
      }),
      notifications: jsonSafe(notifications),
      audit: jsonSafe(
        audit.map((row) => ({
          module: row.module,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          createdAt: row.createdAt
        }))
      )
    };
  }
}
