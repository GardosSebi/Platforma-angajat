import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmCssmMeetingKind,
  SsmCssmMeetingStatus,
  SsmCssmMemberRole
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
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
import { renderCssmMinutes } from "../legal-forms/cssm-minutes";

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

@Injectable()
export class SsmCssmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
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
    return { items: rows.map((row) => this.mapCommittee(row)) };
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
    return this.mapCommittee(row, true);
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
    await this.seedAttendees(tenantId, meetingId, meeting.committeeId);
    await this.prisma.ssmCssmMeeting.update({
      where: { id: meetingId },
      data: {
        status: SsmCssmMeetingStatus.CONVENED,
        convenedAt: new Date(),
        convenedBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "CSSM_MEETING_CONVENED",
      entityType: "SsmCssmMeeting",
      entityId: meetingId,
      payload: {}
    });
    return this.getMeeting(tenantId, meetingId);
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
    return this.getMeeting(tenantId, meetingId);
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

  private compositionWarnings(members: Array<{ role: SsmCssmMemberRole; active: boolean }>) {
    const active = members.filter((m) => m.active);
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
    return warnings;
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
