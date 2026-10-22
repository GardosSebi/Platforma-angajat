import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmCssmMeetingKind,
  SsmCssmMeetingStatus,
  SsmCssmMemberRole,
  SsmDocumentStatus,
  SsmDocumentTargetType,
  SsmDocumentType
} from "@prisma/client";
import JSZip from "jszip";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { NotificationsService } from "../../../../infrastructure/notifications/notifications.service";
import {
  CreateSsmCssmCommitteeDto,
  CreateSsmCssmMeetingDto,
  CreateSsmCssmMemberDto,
  UpdateSsmCssmAttendeeDto,
  UpdateSsmCssmCommitteeDto,
  UpdateSsmCssmMeetingDto,
  UpdateSsmCssmMemberDto,
  UpsertSsmCssmMinutesDto
} from "../../api/dto/ssm-cssm.dto";
import { renderCssmConvocation } from "../legal-forms/cssm-convocation";
import { renderCssmDecision } from "../legal-forms/cssm-decision";
import { renderCssmMinutes } from "../legal-forms/cssm-minutes";
import { SsmDocumentsService } from "./ssm-documents.service";

const CSSM_ROLE_LABEL: Record<SsmCssmMemberRole, string> = {
  PRESIDENT: "Președinte",
  SECRETARY: "Secretar",
  EMPLOYER_REPRESENTATIVE: "Reprezentant angajator",
  EMPLOYEE_REPRESENTATIVE: "Reprezentant lucrători",
  OCCUPATIONAL_PHYSICIAN: "Medic medicina muncii",
  DESIGNATED_WORKER: "Lucrător desemnat",
  OTHER: "Alt rol"
};

const CSSM_KIND_LABEL: Record<SsmCssmMeetingKind, string> = {
  ORDINARY: "Ordinară",
  EXTRAORDINARY: "Extraordinară"
};

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Dată invalidă: ${value}`);
  }
  return d;
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  return parseDate(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_NOTICE_DAYS = 5;
const CADENCE_DUE_SOON_DAYS = 30;
const CADENCE_REMINDER_COOLDOWN_DAYS = 7;
const MEETING_REMINDER_DAYS = 2;
const TERM_ENDING_DAYS = 30;

type CadenceStatus = "OK" | "SCHEDULED" | "DUE_SOON" | "OVERDUE";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
}

@Injectable()
export class SsmCssmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly documentsService: SsmDocumentsService,
    private readonly mailService: MailService,
    private readonly notifications: NotificationsService
  ) {}

  async listCommittees(tenantId: string) {
    const rows = await this.prisma.ssmCssmCommittee.findMany({
      where: { tenantId },
      include: {
        legalEntity: { select: { id: true, name: true, cui: true, headquarters: true } },
        members: { orderBy: [{ active: "desc" }, { fullName: "asc" }] },
        meetings: {
          orderBy: { scheduledAt: "desc" },
          take: 12,
          include: { minutes: { select: { id: true, number: true } } }
        }
      },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });
    const items = rows.map((row) => this.mapCommittee(row));
    return { items: await this.attachCadence(tenantId, await this.attachDecisionDocuments(tenantId, items)) };
  }

  async getCommittee(tenantId: string, committeeId: string) {
    const row = await this.prisma.ssmCssmCommittee.findFirst({
      where: { id: committeeId, tenantId },
      include: {
        legalEntity: { select: { id: true, name: true, cui: true, headquarters: true } },
        members: { orderBy: [{ active: "desc" }, { fullName: "asc" }] },
        meetings: {
          orderBy: { scheduledAt: "desc" },
          include: {
            attendees: { orderBy: { fullName: "asc" } },
            minutes: true
          }
        }
      }
    });
    if (!row) throw new NotFoundException("Comisia CSSM nu a fost găsită.");
    const [committee] = await this.attachCadence(
      tenantId,
      await this.attachDecisionDocuments(tenantId, [this.mapCommittee(row, true)])
    );
    return committee;
  }

  async createCommittee(tenantId: string, actorId: string, dto: CreateSsmCssmCommitteeDto) {
    const entity = await this.prisma.legalEntity.findFirst({
      where: { id: dto.legalEntityId, tenantId, active: true }
    });
    if (!entity) throw new NotFoundException("Entitatea juridică nu a fost găsită.");

    const created = await this.prisma.ssmCssmCommittee.create({
      data: {
        tenantId,
        legalEntityId: entity.id,
        name: dto.name.trim(),
        decisionNumber: dto.decisionNumber?.trim() || null,
        decisionDate: parseOptionalDate(dto.decisionDate),
        constitutedAt: parseOptionalDate(dto.constitutedAt),
        notes: dto.notes?.trim() || null,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_COMMITTEE_CREATED",
      entityType: "SsmCssmCommittee",
      entityId: created.id,
      payload: { legalEntityId: entity.id }
    });
    await this.publishAppointmentDecision(tenantId, actorId, created.id);
    return this.getCommittee(tenantId, created.id);
  }

  async updateCommittee(tenantId: string, actorId: string, committeeId: string, dto: UpdateSsmCssmCommitteeDto) {
    await this.assertCommittee(tenantId, committeeId);
    await this.prisma.ssmCssmCommittee.update({
      where: { id: committeeId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.decisionNumber !== undefined ? { decisionNumber: dto.decisionNumber.trim() || null } : {}),
        ...(dto.decisionDate !== undefined ? { decisionDate: parseOptionalDate(dto.decisionDate) } : {}),
        ...(dto.constitutedAt !== undefined ? { constitutedAt: parseOptionalDate(dto.constitutedAt) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.meetingIntervalMonths !== undefined
          ? { meetingIntervalMonths: dto.meetingIntervalMonths, cadenceReminderSentAt: null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {})
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_COMMITTEE_UPDATED",
      entityType: "SsmCssmCommittee",
      entityId: committeeId,
      payload: { ...dto }
    });
    await this.publishAppointmentDecision(tenantId, actorId, committeeId);
    return this.getCommittee(tenantId, committeeId);
  }

  async addMember(tenantId: string, actorId: string, committeeId: string, dto: CreateSsmCssmMemberDto) {
    await this.assertCommittee(tenantId, committeeId);
    const person = await this.resolvePerson(tenantId, dto.employeeId, dto.fullName, dto.functionTitle);
    const created = await this.prisma.ssmCssmMember.create({
      data: {
        tenantId,
        committeeId,
        employeeId: person.employeeId,
        fullName: person.fullName,
        role: dto.role,
        functionTitle: person.functionTitle,
        appointedAt: parseOptionalDate(dto.appointedAt),
        termEndsAt: parseOptionalDate(dto.termEndsAt),
        notes: dto.notes?.trim() || null
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEMBER_ADDED",
      entityType: "SsmCssmMember",
      entityId: created.id,
      payload: { committeeId, role: dto.role }
    });
    await this.publishAppointmentDecision(tenantId, actorId, committeeId);
    return this.mapMember(created);
  }

  async updateMember(tenantId: string, actorId: string, memberId: string, dto: UpdateSsmCssmMemberDto) {
    const existing = await this.prisma.ssmCssmMember.findFirst({ where: { id: memberId, tenantId } });
    if (!existing) throw new NotFoundException("Membrul CSSM nu a fost găsit.");
    const person =
      dto.employeeId !== undefined || dto.fullName !== undefined || dto.functionTitle !== undefined
        ? await this.resolvePerson(
            tenantId,
            dto.employeeId === undefined ? existing.employeeId ?? undefined : dto.employeeId,
            dto.fullName ?? existing.fullName,
            dto.functionTitle !== undefined ? dto.functionTitle : existing.functionTitle
          )
        : null;
    const updated = await this.prisma.ssmCssmMember.update({
      where: { id: memberId },
      data: {
        ...(person
          ? {
              employeeId: person.employeeId,
              fullName: person.fullName,
              functionTitle: person.functionTitle
            }
          : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.appointedAt !== undefined ? { appointedAt: parseOptionalDate(dto.appointedAt) } : {}),
        ...(dto.termEndsAt !== undefined ? { termEndsAt: parseOptionalDate(dto.termEndsAt) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {})
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEMBER_UPDATED",
      entityType: "SsmCssmMember",
      entityId: memberId,
      payload: { ...dto }
    });
    await this.publishAppointmentDecision(tenantId, actorId, existing.committeeId);
    return this.mapMember(updated);
  }

  async createMeeting(tenantId: string, actorId: string, committeeId: string, dto: CreateSsmCssmMeetingDto) {
    await this.assertCommittee(tenantId, committeeId);
    const created = await this.prisma.ssmCssmMeeting.create({
      data: {
        tenantId,
        committeeId,
        kind: dto.kind ?? SsmCssmMeetingKind.ORDINARY,
        title: dto.title.trim(),
        scheduledAt: parseDate(dto.scheduledAt),
        location: dto.location?.trim() || null,
        agenda: dto.agenda?.trim() || null,
        createdBy: actorId
      }
    });
    await this.seedAttendees(tenantId, created.id, committeeId);
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_CREATED",
      entityType: "SsmCssmMeeting",
      entityId: created.id,
      payload: { committeeId }
    });
    return this.getMeeting(tenantId, created.id);
  }

  async updateMeeting(tenantId: string, actorId: string, meetingId: string, dto: UpdateSsmCssmMeetingDto) {
    const meeting = await this.assertMeeting(tenantId, meetingId);
    if (meeting.status === SsmCssmMeetingStatus.CANCELLED) {
      throw new BadRequestException("Ședința anulată nu mai poate fi modificată.");
    }
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: {
        ...(dto.kind ? { kind: dto.kind } : {}),
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.scheduledAt ? { scheduledAt: parseDate(dto.scheduledAt) } : {}),
        ...(dto.location !== undefined ? { location: dto.location.trim() || null } : {}),
        ...(dto.agenda !== undefined ? { agenda: dto.agenda.trim() || null } : {})
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_UPDATED",
      entityType: "SsmCssmMeeting",
      entityId: meetingId,
      payload: { ...dto }
    });
    return this.getMeeting(tenantId, meetingId);
  }

  async conveneMeeting(tenantId: string, actorId: string, meetingId: string) {
    const meeting = await this.assertMeeting(tenantId, meetingId);
    if (meeting.status === SsmCssmMeetingStatus.CANCELLED) {
      throw new BadRequestException("Ședința anulată nu poate fi convocată.");
    }
    if (meeting.status === SsmCssmMeetingStatus.HELD) {
      throw new BadRequestException("Ședința a fost deja ținută.");
    }
    await this.seedAttendees(tenantId, meetingId, meeting.committeeId);
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: {
        status: SsmCssmMeetingStatus.CONVENED,
        convenedAt: new Date(),
        convenedBy: actorId
      }
    });
    const delivery = await this.notifyAttendees(tenantId, meetingId, "CONVOCATION");
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: { notificationsSentAt: new Date() }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_CONVENED",
      entityType: "SsmCssmMeeting",
      entityId: meetingId,
      payload: { email: delivery.email, inApp: delivery.inApp, withoutContact: delivery.withoutContact }
    });
    const result = await this.getMeeting(tenantId, meetingId);
    return { ...result, lastNotification: { email: delivery.email, inApp: delivery.inApp } };
  }

  /** Trimite convocarea (cu PDF atașat) sau reamintirea către membrii convocați: e-mail + notificare în aplicație. */
  private async notifyAttendees(tenantId: string, meetingId: string, kind: "CONVOCATION" | "REMINDER") {
    const meeting = await this.loadMeetingForPdf(tenantId, meetingId);
    const employeeIds = meeting.attendees.map((row) => row.employeeId).filter((id): id is string => Boolean(id));
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: { tenantId, id: { in: employeeIds } },
          select: { id: true, email: true }
        })
      : [];
    const emailByEmployee = new Map(employees.map((row) => [row.id, row.email]));

    const when = meeting.scheduledAt.toLocaleString("ro-RO", { dateStyle: "long", timeStyle: "short" });
    const subject =
      kind === "CONVOCATION"
        ? `Convocare CSSM — ${meeting.title} (${when})`
        : `Reamintire ședință CSSM — ${meeting.title} (${when})`;
    const text = [
      kind === "CONVOCATION"
        ? `Sunteți convocat(ă) la ședința ${CSSM_KIND_LABEL[meeting.kind].toLowerCase()} a ${meeting.committee.name}.`
        : `Vă reamintim ședința ${CSSM_KIND_LABEL[meeting.kind].toLowerCase()} a ${meeting.committee.name}.`,
      `Data și ora: ${when}`,
      `Locul: ${meeting.location ?? "—"}`,
      "",
      "Ordinea de zi:",
      meeting.agenda?.trim() || "—"
    ].join("\n");
    const attachment =
      kind === "CONVOCATION"
        ? [
            {
              filename: `Convocare-CSSM-${safeFileName(meeting.title)}.pdf`,
              content: await this.convocationPdf(tenantId, meetingId),
              contentType: "application/pdf"
            }
          ]
        : undefined;

    let email = 0;
    let inApp = 0;
    let withoutContact = 0;
    for (const attendee of meeting.attendees) {
      const address = attendee.employeeId ? emailByEmployee.get(attendee.employeeId) : undefined;
      if (!attendee.employeeId && !address) {
        withoutContact += 1;
        continue;
      }
      if (address) {
        try {
          const sent = await this.mailService.sendMail({ to: address, subject, text, attachments: attachment });
          if (sent.sent) email += 1;
        } catch {
          // un e-mail eșuat nu blochează restul convocărilor
        }
      }
      if (attendee.employeeId) {
        const notified = await this.notifications.notifyEmployee({
          tenantId,
          employeeId: attendee.employeeId,
          category: "SSM_CSSM",
          title: subject,
          body: `${when} · ${meeting.location ?? "locație nespecificată"}`,
          linkPath: "/ssm?section=cssm",
          entityType: "SsmCssmMeeting",
          entityId: meetingId
        });
        if (notified) inApp += 1;
      }
    }
    return { email, inApp, withoutContact };
  }

  async holdMeeting(tenantId: string, actorId: string, meetingId: string) {
    const meeting = await this.assertMeeting(tenantId, meetingId);
    if (meeting.status === SsmCssmMeetingStatus.CANCELLED) {
      throw new BadRequestException("Ședința anulată nu poate fi marcată ca ținută.");
    }
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: {
        status: SsmCssmMeetingStatus.HELD,
        heldAt: meeting.heldAt ?? new Date()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_HELD",
      entityType: "SsmCssmMeeting",
      entityId: meetingId,
      payload: {}
    });
    return this.getMeeting(tenantId, meetingId);
  }

  async cancelMeeting(tenantId: string, actorId: string, meetingId: string) {
    const meeting = await this.assertMeeting(tenantId, meetingId);
    if (meeting.status === SsmCssmMeetingStatus.HELD) {
      throw new BadRequestException("Ședința ținută nu poate fi anulată.");
    }
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: {
        status: SsmCssmMeetingStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_CANCELLED",
      entityType: "SsmCssmMeeting",
      entityId: meetingId,
      payload: {}
    });
    return this.getMeeting(tenantId, meetingId);
  }

  async updateAttendee(tenantId: string, actorId: string, attendeeId: string, dto: UpdateSsmCssmAttendeeDto) {
    const attendee = await this.prisma.ssmCssmMeetingAttendee.findFirst({
      where: { id: attendeeId, tenantId }
    });
    if (!attendee) throw new NotFoundException("Participantul nu a fost găsit.");
    const signature = dto.signature?.trim();
    const updated = await this.prisma.ssmCssmMeetingAttendee.update({
      where: { id: attendeeId },
      data: {
        ...(dto.present !== undefined ? { present: dto.present } : {}),
        ...(signature
          ? { signature, signedAt: new Date(), present: true }
          : {})
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_ATTENDEE_UPDATED",
      entityType: "SsmCssmMeetingAttendee",
      entityId: attendeeId,
      payload: { present: updated.present }
    });
    const hasMinutes = await this.prisma.ssmCssmMinutes.count({ where: { tenantId, meetingId: attendee.meetingId } });
    if (hasMinutes) {
      await this.publishMinutesDocument(tenantId, actorId, attendee.meetingId, "Actualizare prezență / semnături");
    }
    return this.mapAttendee(updated);
  }

  async upsertMinutes(tenantId: string, actorId: string, meetingId: string, dto: UpsertSsmCssmMinutesDto) {
    const meeting = await this.assertMeeting(tenantId, meetingId);
    if (meeting.status === SsmCssmMeetingStatus.CANCELLED) {
      throw new BadRequestException("Nu se poate întocmi proces-verbal pentru o ședință anulată.");
    }
    const number = dto.number?.trim() || (await this.nextMinutesNumber(tenantId, meeting.committeeId));
    const minutes = await this.prisma.ssmCssmMinutes.upsert({
      where: { meetingId },
      create: {
        tenantId,
        meetingId,
        number,
        topics: dto.topics?.trim() || null,
        decisions: dto.decisions?.trim() || null,
        nextMeetingAt: parseOptionalDate(dto.nextMeetingAt),
        createdBy: actorId
      },
      update: {
        ...(dto.number !== undefined ? { number } : {}),
        ...(dto.topics !== undefined ? { topics: dto.topics.trim() || null } : {}),
        ...(dto.decisions !== undefined ? { decisions: dto.decisions.trim() || null } : {}),
        ...(dto.nextMeetingAt !== undefined ? { nextMeetingAt: parseOptionalDate(dto.nextMeetingAt) } : {})
      }
    });
    if (meeting.status !== SsmCssmMeetingStatus.HELD) {
      await this.prisma.ssmCssmMeeting.update({
        where: { id: meetingId },
        data: { status: SsmCssmMeetingStatus.HELD, heldAt: meeting.heldAt ?? new Date() }
      });
    }
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MINUTES_SAVED",
      entityType: "SsmCssmMinutes",
      entityId: minutes.id,
      payload: { meetingId, number: minutes.number }
    });
    await this.publishMinutesDocument(tenantId, actorId, meetingId, `Proces-verbal ${minutes.number} salvat`);
    return this.getMeeting(tenantId, meetingId);
  }

  /** PV-ul se arhivează automat în Documente SSM (dosar de control), versionat la fiecare modificare. */
  private async publishMinutesDocument(tenantId: string, actorId: string, meetingId: string, changeNote: string) {
    const meeting = await this.loadMeetingForPdf(tenantId, meetingId);
    if (!meeting.minutes) return null;
    const buffer = await this.minutesPdf(tenantId, meetingId);
    const entity = meeting.committee.legalEntity;
    const result = await this.documentsService.upsertGeneratedPdf(tenantId, actorId, {
      type: SsmDocumentType.REGISTER,
      title: `PV ședință CSSM ${meeting.minutes.number} — ${entity.name} (${meeting.scheduledAt.toLocaleDateString("ro-RO")})`,
      targetType: SsmDocumentTargetType.ENTITY,
      targetRefId: meeting.id,
      targetLabel: entity.name,
      entityName: entity.name,
      legalEntityId: meeting.committee.legalEntityId,
      fileName: `PV-CSSM-${safeFileName(meeting.minutes.number)}.pdf`,
      buffer,
      changeNote,
      isControlFolder: true,
      matchDocumentId: meeting.minutesDocumentId ?? null
    });
    if (meeting.minutesDocumentId !== result.documentId) {
      await this.prisma.ssmCssmMeeting.update({ where: { id: meetingId }, data: { minutesDocumentId: result.documentId } });
    }
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MINUTES_DOCUMENT_PUBLISHED",
      entityType: "SsmDocument",
      entityId: result.documentId,
      payload: { meetingId, versionNumber: result.versionNumber, created: result.created }
    });
    return result;
  }

  async archive(tenantId: string, legalEntityId?: string) {
    const committees = await this.prisma.ssmCssmCommittee.findMany({
      where: { tenantId, ...(legalEntityId ? { legalEntityId } : {}) },
      include: {
        legalEntity: { select: { id: true, name: true, cui: true } },
        meetings: {
          orderBy: { scheduledAt: "desc" },
          include: {
            minutes: { select: { id: true, number: true } },
            attendees: { select: { present: true, signedAt: true } }
          }
        }
      },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });
    const decisionDocs = await this.attachDecisionDocuments(
      tenantId,
      committees.map((row) => ({ id: row.id }))
    );
    const decisionByCommittee = new Map(decisionDocs.map((row) => [row.id, row.decisionDocumentId]));

    type ArchiveCommittee = {
      id: string;
      name: string;
      active: boolean;
      decisionNumber: string | null;
      decisionDate: string | null;
      decisionDocumentId: string | null;
      years: Array<{ year: number; heldCount: number; quartersCovered: number[]; meetings: unknown[] }>;
    };
    const entities = new Map<
      string,
      { legalEntityId: string; legalEntityName: string; legalEntityCui: string | null; committees: ArchiveCommittee[] }
    >();
    for (const committee of committees) {
      const byYear = new Map<number, typeof committee.meetings>();
      for (const meeting of committee.meetings) {
        const year = (meeting.heldAt ?? meeting.scheduledAt).getFullYear();
        byYear.set(year, [...(byYear.get(year) ?? []), meeting]);
      }
      const years = [...byYear.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, meetings]) => {
          const held = meetings.filter((row) => row.status === SsmCssmMeetingStatus.HELD);
          const quarters = new Set(held.map((row) => Math.floor((row.heldAt ?? row.scheduledAt).getMonth() / 3) + 1));
          return {
            year,
            heldCount: held.length,
            quartersCovered: [...quarters].sort(),
            meetings: meetings.map((meeting) => ({
              id: meeting.id,
              title: meeting.title,
              kind: meeting.kind,
              kindLabel: CSSM_KIND_LABEL[meeting.kind],
              status: meeting.status,
              scheduledAt: meeting.scheduledAt.toISOString(),
              heldAt: meeting.heldAt?.toISOString() ?? null,
              convenedAt: meeting.convenedAt?.toISOString() ?? null,
              minutesNumber: meeting.minutes?.number ?? null,
              minutesDocumentId: meeting.minutesDocumentId,
              attendeeCount: meeting.attendees.length,
              presentCount: meeting.attendees.filter((row) => row.present).length,
              signedCount: meeting.attendees.filter((row) => row.signedAt).length
            }))
          };
        });
      const entry = entities.get(committee.legalEntityId) ?? {
        legalEntityId: committee.legalEntityId,
        legalEntityName: committee.legalEntity.name,
        legalEntityCui: committee.legalEntity.cui,
        committees: []
      };
      entry.committees.push({
        id: committee.id,
        name: committee.name,
        active: committee.active,
        decisionNumber: committee.decisionNumber,
        decisionDate: committee.decisionDate?.toISOString() ?? null,
        decisionDocumentId: decisionByCommittee.get(committee.id) ?? null,
        years
      });
      entities.set(committee.legalEntityId, entry);
    }
    return { items: [...entities.values()] };
  }

  async archiveZip(tenantId: string, actorId: string, committeeId: string, year?: number) {
    const committee = await this.loadCommitteeForDecision(tenantId, committeeId);
    const meetings = await this.prisma.ssmCssmMeeting.findMany({
      where: {
        tenantId,
        committeeId,
        ...(year
          ? { scheduledAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
          : {})
      },
      include: { minutes: { select: { number: true } } },
      orderBy: { scheduledAt: "asc" }
    });
    const zip = new JSZip();
    const warnings: string[] = [];
    if (committee.decisionNumber?.trim()) {
      zip.file(`00-Decizie-CSSM-${safeFileName(committee.decisionNumber)}.pdf`, await this.renderAppointmentDecision(committee));
    }
    const register: string[][] = [["Data", "Titlu", "Tip", "Stare", "Convocat la", "PV"]];
    for (const meeting of meetings) {
      const prefix = `${meeting.scheduledAt.toISOString().slice(0, 10)}-${safeFileName(meeting.title)}`;
      register.push([
        meeting.scheduledAt.toISOString().slice(0, 10),
        meeting.title,
        CSSM_KIND_LABEL[meeting.kind],
        meeting.status,
        meeting.convenedAt?.toISOString().slice(0, 10) ?? "",
        meeting.minutes?.number ?? ""
      ]);
      if (meeting.status === SsmCssmMeetingStatus.CANCELLED) continue;
      try {
        zip.file(`sedinte/${prefix}/Convocare.pdf`, await this.convocationPdf(tenantId, meeting.id));
        if (meeting.minutes) {
          zip.file(
            `sedinte/${prefix}/PV-${safeFileName(meeting.minutes.number)}.pdf`,
            await this.minutesPdf(tenantId, meeting.id)
          );
        } else if (meeting.status === SsmCssmMeetingStatus.HELD) {
          warnings.push(`Ședința din ${meeting.scheduledAt.toLocaleDateString("ro-RO")} nu are proces-verbal.`);
        }
      } catch {
        warnings.push(`Nu s-au putut genera documentele pentru ședința „${meeting.title}”.`);
      }
    }
    zip.file(
      "registru-sedinte.csv",
      "\uFEFF" +
        register
          .map((row) => row.map((cell) => (/[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(";"))
          .join("\r\n")
    );
    if (warnings.length) zip.file("warnings.txt", warnings.map((line) => `- ${line}`).join("\r\n"));

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_ARCHIVE_EXPORTED",
      entityType: "SsmCssmCommittee",
      entityId: committeeId,
      payload: { year: year ?? null, meetings: meetings.length }
    });
    return {
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
      fileName: `Arhiva-CSSM-${safeFileName(committee.legalEntity.name)}-${year ?? "complet"}.zip`
    };
  }

  /** Cron zilnic: termen trimestrial de ședință și reamintiri pentru ședințele convocate. */
  async dispatchReminders(tenantId: string, actorId: string) {
    const now = new Date();
    const committees = await this.prisma.ssmCssmCommittee.findMany({
      where: { tenantId, active: true },
      include: {
        legalEntity: { select: { name: true } },
        members: { where: { active: true }, select: { employeeId: true, role: true } }
      }
    });
    const cadence = await this.computeCadence(tenantId, committees.map((row) => row.id));

    let cadenceReminders = 0;
    for (const committee of committees) {
      const state = cadence.get(committee.id);
      if (!state || (state.status !== "DUE_SOON" && state.status !== "OVERDUE")) continue;
      if (
        committee.cadenceReminderSentAt &&
        now.getTime() - committee.cadenceReminderSentAt.getTime() < CADENCE_REMINDER_COOLDOWN_DAYS * DAY_MS
      ) {
        continue;
      }
      const recipients = committee.members
        .filter((row) => row.employeeId && (row.role === "PRESIDENT" || row.role === "SECRETARY"))
        .map((row) => row.employeeId as string);
      const title =
        state.status === "OVERDUE"
          ? `Ședința CSSM este restantă — ${committee.legalEntity.name}`
          : `Termen ședință CSSM în ${state.daysUntilDue} zile — ${committee.legalEntity.name}`;
      for (const employeeId of new Set(recipients)) {
        await this.notifications.notifyEmployee({
          tenantId,
          employeeId,
          category: "SSM_CSSM",
          title,
          body: `Comitetul se întrunește cel puțin o dată la ${committee.meetingIntervalMonths} luni. Termen: ${
            state.nextDueAt ? new Date(state.nextDueAt).toLocaleDateString("ro-RO") : "—"
          }.`,
          linkPath: "/ssm?section=cssm",
          entityType: "SsmCssmCommittee",
          entityId: committee.id
        });
      }
      await this.prisma.ssmCssmCommittee.update({ where: { id: committee.id }, data: { cadenceReminderSentAt: now } });
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "CSSM_CADENCE_REMINDER",
        entityType: "SsmCssmCommittee",
        entityId: committee.id,
        payload: { status: state.status, recipients: recipients.length }
      });
      cadenceReminders += 1;
    }

    const upcoming = await this.prisma.ssmCssmMeeting.findMany({
      where: {
        tenantId,
        status: SsmCssmMeetingStatus.CONVENED,
        reminderSentAt: null,
        scheduledAt: { gte: now, lte: new Date(now.getTime() + MEETING_REMINDER_DAYS * DAY_MS) }
      },
      select: { id: true }
    });
    for (const meeting of upcoming) {
      const delivery = await this.notifyAttendees(tenantId, meeting.id, "REMINDER");
      await this.prisma.ssmCssmMeeting.update({ where: { id: meeting.id }, data: { reminderSentAt: now } });
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "CSSM_MEETING_REMINDER",
        entityType: "SsmCssmMeeting",
        entityId: meeting.id,
        payload: { email: delivery.email, inApp: delivery.inApp }
      });
    }
    return { cadenceReminders, meetingReminders: upcoming.length };
  }

  private async computeCadence(tenantId: string, committeeIds: string[]) {
    const result = new Map<
      string,
      {
        intervalMonths: number;
        lastHeldAt: string | null;
        nextDueAt: string | null;
        upcomingMeetingAt: string | null;
        status: CadenceStatus;
        daysUntilDue: number | null;
      }
    >();
    if (!committeeIds.length) return result;
    const now = new Date();
    const [committees, held, upcoming] = await Promise.all([
      this.prisma.ssmCssmCommittee.findMany({
        where: { tenantId, id: { in: committeeIds } },
        select: { id: true, meetingIntervalMonths: true, constitutedAt: true, decisionDate: true, createdAt: true }
      }),
      this.prisma.ssmCssmMeeting.groupBy({
        by: ["committeeId"],
        where: { tenantId, committeeId: { in: committeeIds }, status: SsmCssmMeetingStatus.HELD },
        _max: { heldAt: true, scheduledAt: true }
      }),
      this.prisma.ssmCssmMeeting.groupBy({
        by: ["committeeId"],
        where: {
          tenantId,
          committeeId: { in: committeeIds },
          status: { in: [SsmCssmMeetingStatus.DRAFT, SsmCssmMeetingStatus.CONVENED] },
          scheduledAt: { gte: now }
        },
        _min: { scheduledAt: true }
      })
    ]);
    const heldBy = new Map(held.map((row) => [row.committeeId, row._max.heldAt ?? row._max.scheduledAt]));
    const upcomingBy = new Map(upcoming.map((row) => [row.committeeId, row._min.scheduledAt]));

    for (const committee of committees) {
      const lastHeld = heldBy.get(committee.id) ?? null;
      const base = lastHeld ?? committee.constitutedAt ?? committee.decisionDate ?? committee.createdAt;
      const nextDue = addMonths(base, committee.meetingIntervalMonths);
      const upcomingAt = upcomingBy.get(committee.id) ?? null;
      const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / DAY_MS);
      let status: CadenceStatus;
      if (upcomingAt && upcomingAt <= nextDue) status = "SCHEDULED";
      else if (daysUntilDue < 0) status = "OVERDUE";
      else if (daysUntilDue <= CADENCE_DUE_SOON_DAYS) status = "DUE_SOON";
      else status = "OK";
      result.set(committee.id, {
        intervalMonths: committee.meetingIntervalMonths,
        lastHeldAt: lastHeld?.toISOString() ?? null,
        nextDueAt: nextDue.toISOString(),
        upcomingMeetingAt: upcomingAt?.toISOString() ?? null,
        status,
        daysUntilDue
      });
    }
    return result;
  }

  private async attachCadence<T extends { id: string; compositionWarnings: string[] }>(tenantId: string, items: T[]) {
    const cadence = await this.computeCadence(
      tenantId,
      items.map((item) => item.id)
    );
    return items.map((item) => {
      const state = cadence.get(item.id) ?? null;
      const warnings = [...item.compositionWarnings];
      if (state?.status === "OVERDUE") {
        warnings.push(
          `Termenul de ședință a fost depășit (${state.daysUntilDue != null ? Math.abs(state.daysUntilDue) : "?"} zile) — CSSM se întrunește cel puțin o dată la ${state.intervalMonths} luni.`
        );
      }
      return { ...item, meetingIntervalMonths: state?.intervalMonths ?? 3, cadence: state, compositionWarnings: warnings };
    });
  }

  async decisionPdf(tenantId: string, committeeId: string) {
    const committee = await this.loadCommitteeForDecision(tenantId, committeeId);
    return this.renderAppointmentDecision(committee);
  }

  async convocationPdf(tenantId: string, meetingId: string) {
    const meeting = await this.loadMeetingForPdf(tenantId, meetingId);
    return renderCssmConvocation({
      employerName: meeting.committee.legalEntity.name,
      cui: meeting.committee.legalEntity.cui,
      headquarters: meeting.committee.legalEntity.headquarters,
      committeeName: meeting.committee.name,
      decisionNumber: meeting.committee.decisionNumber,
      meetingTitle: meeting.title,
      kind: CSSM_KIND_LABEL[meeting.kind],
      scheduledAt: meeting.scheduledAt,
      location: meeting.location,
      agenda: meeting.agenda,
      convenedAt: meeting.convenedAt,
      members: meeting.attendees.map((row) => ({
        fullName: row.fullName,
        role: row.role ? CSSM_ROLE_LABEL[row.role] : "",
        functionTitle: row.member?.functionTitle
      }))
    });
  }

  async minutesPdf(tenantId: string, meetingId: string) {
    const meeting = await this.loadMeetingForPdf(tenantId, meetingId);
    if (!meeting.minutes) {
      throw new BadRequestException("Procesul-verbal nu a fost încă întocmit.");
    }
    return renderCssmMinutes({
      employerName: meeting.committee.legalEntity.name,
      cui: meeting.committee.legalEntity.cui,
      headquarters: meeting.committee.legalEntity.headquarters,
      committeeName: meeting.committee.name,
      decisionNumber: meeting.committee.decisionNumber,
      meetingTitle: meeting.title,
      kind: CSSM_KIND_LABEL[meeting.kind],
      scheduledAt: meeting.scheduledAt,
      heldAt: meeting.heldAt,
      location: meeting.location,
      agenda: meeting.agenda,
      minutesNumber: meeting.minutes.number,
      topics: meeting.minutes.topics,
      decisions: meeting.minutes.decisions,
      nextMeetingAt: meeting.minutes.nextMeetingAt,
      attendees: meeting.attendees.map((row) => ({
        fullName: row.fullName,
        role: row.role ? CSSM_ROLE_LABEL[row.role] : null,
        present: row.present,
        signedAt: row.signedAt,
        signature: row.signature
      }))
    });
  }

  private async getMeeting(tenantId: string, meetingId: string) {
    const meeting = await this.prisma.ssmCssmMeeting.findFirst({
      where: { id: meetingId, tenantId },
      include: {
        attendees: { orderBy: { fullName: "asc" } },
        minutes: true
      }
    });
    if (!meeting) throw new NotFoundException("Ședința CSSM nu a fost găsită.");
    return this.mapMeeting(meeting);
  }

  private async loadMeetingForPdf(tenantId: string, meetingId: string) {
    const meeting = await this.prisma.ssmCssmMeeting.findFirst({
      where: { id: meetingId, tenantId },
      include: {
        committee: {
          include: { legalEntity: { select: { name: true, cui: true, headquarters: true } } }
        },
        attendees: {
          orderBy: { fullName: "asc" },
          include: { member: { select: { functionTitle: true } } }
        },
        minutes: true
      }
    });
    if (!meeting) throw new NotFoundException("Ședința CSSM nu a fost găsită.");
    return meeting;
  }

  private async seedAttendees(tenantId: string, meetingId: string, committeeId: string) {
    const existing = await this.prisma.ssmCssmMeetingAttendee.count({ where: { tenantId, meetingId } });
    if (existing > 0) return;
    const members = await this.prisma.ssmCssmMember.findMany({
      where: { tenantId, committeeId, active: true }
    });
    if (!members.length) return;
    await this.prisma.ssmCssmMeetingAttendee.createMany({
      data: members.map((member) => ({
        tenantId,
        meetingId,
        memberId: member.id,
        employeeId: member.employeeId,
        fullName: member.fullName,
        role: member.role
      }))
    });
  }

  private async nextMinutesNumber(tenantId: string, committeeId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.ssmCssmMinutes.count({
      where: {
        tenantId,
        meeting: { committeeId },
        number: { startsWith: `PV-CSSM-${year}-` }
      }
    });
    return `PV-CSSM-${year}-${String(count + 1).padStart(3, "0")}`;
  }

  private async resolvePerson(
    tenantId: string,
    employeeId?: string | null,
    fullName?: string,
    functionTitle?: string | null
  ) {
    if (employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        include: { jobPosition: { select: { name: true } } }
      });
      if (!employee) throw new NotFoundException("Angajatul selectat nu a fost găsit.");
      return {
        employeeId: employee.id,
        fullName: fullName?.trim() || employee.fullName,
        functionTitle: functionTitle?.trim() || employee.jobPosition?.name || null
      };
    }
    const name = fullName?.trim();
    if (!name) {
      throw new BadRequestException("Selectează un angajat sau completează numele membrului.");
    }
    return {
      employeeId: null as string | null,
      fullName: name,
      functionTitle: functionTitle?.trim() || null
    };
  }

  private async assertCommittee(tenantId: string, committeeId: string) {
    const row = await this.prisma.ssmCssmCommittee.findFirst({
      where: { id: committeeId, tenantId },
      select: { id: true }
    });
    if (!row) throw new NotFoundException("Comisia CSSM nu a fost găsită.");
    return row;
  }

  private async assertMeeting(tenantId: string, meetingId: string) {
    const row = await this.prisma.ssmCssmMeeting.findFirst({ where: { id: meetingId, tenantId } });
    if (!row) throw new NotFoundException("Ședința CSSM nu a fost găsită.");
    return row;
  }

  private compositionWarnings(
    members: Array<{ role: SsmCssmMemberRole; active: boolean; fullName: string; termEndsAt: Date | null }>
  ) {
    const active = members.filter((m) => m.active);
    const now = Date.now();
    const termWarnings = active
      .filter((m) => m.termEndsAt && m.termEndsAt.getTime() - now <= TERM_ENDING_DAYS * DAY_MS)
      .map((m) =>
        m.termEndsAt && m.termEndsAt.getTime() < now
          ? `Mandatul membrului ${m.fullName} a expirat (${m.termEndsAt.toLocaleDateString("ro-RO")}).`
          : `Mandatul membrului ${m.fullName} expiră la ${m.termEndsAt?.toLocaleDateString("ro-RO")}.`
      );
    const employer = active.filter((m) => m.role === "EMPLOYER_REPRESENTATIVE" || m.role === "PRESIDENT").length;
    const workers = active.filter(
      (m) => m.role === "EMPLOYEE_REPRESENTATIVE" || m.role === "DESIGNATED_WORKER"
    ).length;
    const warnings: string[] = [];
    if (!active.some((m) => m.role === "PRESIDENT")) warnings.push("Lipsește președintele CSSM.");
    if (!active.some((m) => m.role === "SECRETARY")) warnings.push("Lipsește secretarul CSSM.");
    if (employer !== workers) {
      warnings.push("Numărul reprezentanților angajatorului și al lucrătorilor trebuie să fie egal.");
    }
    return [...warnings, ...termWarnings];
  }

  private async loadCommitteeForDecision(tenantId: string, committeeId: string) {
    const committee = await this.prisma.ssmCssmCommittee.findFirst({
      where: { id: committeeId, tenantId },
      include: {
        legalEntity: { select: { id: true, name: true, cui: true, headquarters: true } },
        members: { orderBy: [{ active: "desc" }, { fullName: "asc" }] }
      }
    });
    if (!committee) throw new NotFoundException("Comisia CSSM nu a fost găsită.");
    return committee;
  }

  private renderAppointmentDecision(
    committee: Awaited<ReturnType<SsmCssmService["loadCommitteeForDecision"]>>
  ) {
    return renderCssmDecision({
      employerName: committee.legalEntity.name,
      cui: committee.legalEntity.cui,
      headquarters: committee.legalEntity.headquarters,
      committeeName: committee.name,
      decisionNumber: committee.decisionNumber,
      decisionDate: committee.decisionDate,
      constitutedAt: committee.constitutedAt,
      notes: committee.notes,
      members: committee.members.map((member) => ({
        fullName: member.fullName,
        role: CSSM_ROLE_LABEL[member.role],
        functionTitle: member.functionTitle,
        appointedAt: member.appointedAt,
        termEndsAt: member.termEndsAt,
        active: member.active
      }))
    });
  }

  private async publishAppointmentDecision(tenantId: string, actorId: string, committeeId: string) {
    const committee = await this.loadCommitteeForDecision(tenantId, committeeId);
    if (!committee.decisionNumber?.trim()) return null;
    const buffer = await this.renderAppointmentDecision(committee);
    const safeName = (committee.decisionNumber || committee.name).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
    const result = await this.documentsService.upsertGeneratedPdf(tenantId, actorId, {
      type: SsmDocumentType.DECISION,
      title: `Decizie de numire CSSM — ${committee.legalEntity.name}${
        committee.decisionNumber ? ` nr. ${committee.decisionNumber}` : ""
      }`,
      targetType: SsmDocumentTargetType.ENTITY,
      targetRefId: committee.id,
      targetLabel: committee.legalEntity.name,
      entityName: committee.legalEntity.name,
      legalEntityId: committee.legalEntityId,
      fileName: `Decizie-CSSM-${safeName}.pdf`,
      buffer,
      changeNote: "Generat automat din modulul CSSM (decizie de numire)",
      isControlFolder: true
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_DECISION_DOCUMENT_PUBLISHED",
      entityType: "SsmDocument",
      entityId: result.documentId,
      payload: {
        committeeId: committee.id,
        created: result.created,
        versionNumber: result.versionNumber,
        decisionNumber: committee.decisionNumber
      }
    });
    return result;
  }

  private async attachDecisionDocuments<T extends { id: string }>(tenantId: string, items: T[]) {
    if (!items.length) return items.map((item) => ({ ...item, decisionDocumentId: null as string | null }));
    const docs = await this.prisma.ssmDocument.findMany({
      where: {
        tenantId,
        type: SsmDocumentType.DECISION,
        targetType: SsmDocumentTargetType.ENTITY,
        targetRefId: { in: items.map((item) => item.id) },
        status: { not: SsmDocumentStatus.ARCHIVED }
      },
      select: { id: true, targetRefId: true },
      orderBy: { updatedAt: "desc" }
    });
    const byCommittee = new Map<string, string>();
    for (const doc of docs) {
      if (doc.targetRefId && !byCommittee.has(doc.targetRefId)) {
        byCommittee.set(doc.targetRefId, doc.id);
      }
    }
    return items.map((item) => ({
      ...item,
      decisionDocumentId: byCommittee.get(item.id) ?? null
    }));
  }

  private mapMember(row: {
    id: string;
    employeeId: string | null;
    fullName: string;
    role: SsmCssmMemberRole;
    functionTitle: string | null;
    appointedAt: Date | null;
    termEndsAt: Date | null;
    active: boolean;
    notes: string | null;
  }) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      fullName: row.fullName,
      role: row.role,
      roleLabel: CSSM_ROLE_LABEL[row.role],
      functionTitle: row.functionTitle,
      appointedAt: row.appointedAt?.toISOString() ?? null,
      termEndsAt: row.termEndsAt?.toISOString() ?? null,
      active: row.active,
      notes: row.notes
    };
  }

  private mapAttendee(row: {
    id: string;
    memberId: string | null;
    employeeId: string | null;
    fullName: string;
    role: SsmCssmMemberRole | null;
    present: boolean;
    signature: string | null;
    signedAt: Date | null;
  }) {
    return {
      id: row.id,
      memberId: row.memberId,
      employeeId: row.employeeId,
      fullName: row.fullName,
      role: row.role,
      roleLabel: row.role ? CSSM_ROLE_LABEL[row.role] : null,
      present: row.present,
      hasSignature: Boolean(row.signature),
      signedAt: row.signedAt?.toISOString() ?? null
    };
  }

  private mapMinutes(row: {
    id: string;
    number: string;
    topics: string | null;
    decisions: string | null;
    nextMeetingAt: Date | null;
    updatedAt: Date;
  } | null) {
    if (!row) return null;
    return {
      id: row.id,
      number: row.number,
      topics: row.topics,
      decisions: row.decisions,
      nextMeetingAt: row.nextMeetingAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapMeeting(row: {
    id: string;
    committeeId: string;
    kind: SsmCssmMeetingKind;
    status: SsmCssmMeetingStatus;
    title: string;
    scheduledAt: Date;
    location: string | null;
    agenda: string | null;
    convenedAt: Date | null;
    heldAt: Date | null;
    cancelledAt: Date | null;
    notificationsSentAt?: Date | null;
    minutesDocumentId?: string | null;
    attendees?: Array<{
      id: string;
      memberId: string | null;
      employeeId: string | null;
      fullName: string;
      role: SsmCssmMemberRole | null;
      present: boolean;
      signature: string | null;
      signedAt: Date | null;
    }>;
    minutes?: {
      id: string;
      number: string;
      topics: string | null;
      decisions: string | null;
      nextMeetingAt: Date | null;
      updatedAt: Date;
    } | null;
  }) {
    return {
      ...this.noticeInfo(row),
      notificationsSentAt: row.notificationsSentAt?.toISOString() ?? null,
      minutesDocumentId: row.minutesDocumentId ?? null,
      id: row.id,
      committeeId: row.committeeId,
      kind: row.kind,
      kindLabel: CSSM_KIND_LABEL[row.kind],
      status: row.status,
      title: row.title,
      scheduledAt: row.scheduledAt.toISOString(),
      location: row.location,
      agenda: row.agenda,
      convenedAt: row.convenedAt?.toISOString() ?? null,
      heldAt: row.heldAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      attendees: (row.attendees ?? []).map((item) => this.mapAttendee(item)),
      minutes: this.mapMinutes(row.minutes ?? null),
      hasMinutes: Boolean(row.minutes)
    };
  }

  private noticeInfo(row: { kind: SsmCssmMeetingKind; scheduledAt: Date; convenedAt: Date | null }) {
    if (!row.convenedAt) return { noticeDays: null as number | null, noticeWarning: null as string | null };
    const noticeDays = Math.floor((row.scheduledAt.getTime() - row.convenedAt.getTime()) / DAY_MS);
    const noticeWarning =
      row.kind === SsmCssmMeetingKind.ORDINARY && noticeDays < MIN_NOTICE_DAYS
        ? `Convocarea a fost transmisă cu ${Math.max(0, noticeDays)} zile înainte; recomandat minimum ${MIN_NOTICE_DAYS} zile.`
        : null;
    return { noticeDays, noticeWarning };
  }

  private mapCommittee(
    row: {
      id: string;
      legalEntityId: string;
      name: string;
      decisionNumber: string | null;
      decisionDate: Date | null;
      constitutedAt: Date | null;
      active: boolean;
      notes: string | null;
      legalEntity: { id: string; name: string; cui: string | null; headquarters: string | null };
      members: Array<{
        id: string;
        employeeId: string | null;
        fullName: string;
        role: SsmCssmMemberRole;
        functionTitle: string | null;
        appointedAt: Date | null;
        termEndsAt: Date | null;
        active: boolean;
        notes: string | null;
      }>;
      meetings: Array<{
        id: string;
        committeeId: string;
        kind: SsmCssmMeetingKind;
        status: SsmCssmMeetingStatus;
        title: string;
        scheduledAt: Date;
        location: string | null;
        agenda: string | null;
        convenedAt: Date | null;
        heldAt: Date | null;
        cancelledAt: Date | null;
        notificationsSentAt?: Date | null;
        minutesDocumentId?: string | null;
        attendees?: Array<{
          id: string;
          memberId: string | null;
          employeeId: string | null;
          fullName: string;
          role: SsmCssmMemberRole | null;
          present: boolean;
          signature: string | null;
          signedAt: Date | null;
        }>;
        minutes?: {
          id: string;
          number: string;
          topics: string | null;
          decisions: string | null;
          nextMeetingAt: Date | null;
          updatedAt: Date;
        } | { id: string; number: string } | null;
      }>;
    },
    includeMeetingDetails = false
  ) {
    const members = row.members.map((member) => this.mapMember(member));
    return {
      id: row.id,
      legalEntityId: row.legalEntityId,
      legalEntityName: row.legalEntity.name,
      legalEntityCui: row.legalEntity.cui,
      name: row.name,
      decisionNumber: row.decisionNumber,
      decisionDate: row.decisionDate?.toISOString() ?? null,
      constitutedAt: row.constitutedAt?.toISOString() ?? null,
      active: row.active,
      notes: row.notes,
      compositionWarnings: this.compositionWarnings(row.members),
      members,
      meetings: row.meetings.map((meeting) =>
        includeMeetingDetails && "attendees" in meeting
          ? this.mapMeeting(meeting as Parameters<SsmCssmService["mapMeeting"]>[0])
          : {
              ...this.noticeInfo(meeting),
              notificationsSentAt: meeting.notificationsSentAt?.toISOString() ?? null,
              minutesDocumentId: meeting.minutesDocumentId ?? null,
              id: meeting.id,
              committeeId: row.id,
              kind: meeting.kind,
              kindLabel: CSSM_KIND_LABEL[meeting.kind],
              status: meeting.status,
              title: meeting.title,
              scheduledAt: meeting.scheduledAt.toISOString(),
              location: meeting.location,
              agenda: meeting.agenda,
              convenedAt: meeting.convenedAt?.toISOString() ?? null,
              heldAt: meeting.heldAt?.toISOString() ?? null,
              cancelledAt: meeting.cancelledAt?.toISOString() ?? null,
              attendees: [],
              minutes: meeting.minutes && "topics" in meeting.minutes ? this.mapMinutes(meeting.minutes) : meeting.minutes
                ? { id: meeting.minutes.id, number: meeting.minutes.number, topics: null, decisions: null, nextMeetingAt: null, updatedAt: "" }
                : null,
              hasMinutes: Boolean(meeting.minutes)
            }
      )
    };
  }
}
