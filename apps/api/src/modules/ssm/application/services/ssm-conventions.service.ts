import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SsmConventionStatus,
  SsmDocumentTargetType,
  SsmDocumentType
} from "@prisma/client";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import {
  CreateSsmConventionDto,
  CreateSsmConventionPartyDto,
  ListSsmConventionsDto,
  SignSsmConventionPartyDto,
  TerminateSsmConventionDto,
  UpdateSsmConventionDto,
  UpdateSsmConventionPartyDto
} from "../../api/dto/ssm-conventions.dto";
import { renderSsmConvention } from "../legal-forms";
import { SsmDocumentsService } from "./ssm-documents.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_REMINDER_DAYS = 30;
const UNCOVERED_LOOKBACK_DAYS = 90;

const conventionInclude = {
  worksite: { select: { id: true, name: true, address: true, legalEntityId: true } },
  legalEntity: { select: { id: true, name: true } },
  parties: { orderBy: [{ isHost: "desc" }, { createdAt: "asc" }] }
} satisfies Prisma.SsmConventionInclude;

type ConventionRow = Prisma.SsmConventionGetPayload<{ include: typeof conventionInclude }>;

function trimOrNull(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeCompany(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|srl|sa|pfa|ii)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
}

@Injectable()
export class SsmConventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
    private readonly documentsService: SsmDocumentsService
  ) {}

  async list(tenantId: string, actorId: string, query: ListSsmConventionsDto) {
    await this.expireOutdated(tenantId, actorId);
    const rows = await this.prisma.ssmConvention.findMany({
      where: {
        tenantId,
        ...(query.worksiteId ? { worksiteId: query.worksiteId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: conventionInclude,
      orderBy: [{ status: "asc" }, { startsAt: "desc" }]
    });
    return {
      items: rows.map((row) => this.map(row)),
      uncoveredCompanies: await this.uncoveredCompanies(tenantId, query.worksiteId)
    };
  }

  async get(tenantId: string, id: string) {
    return this.map(await this.load(tenantId, id));
  }

  async create(tenantId: string, actorId: string, dto: CreateSsmConventionDto) {
    const worksite = await this.prisma.worksite.findFirst({
      where: { id: dto.worksiteId, tenantId },
      select: { id: true, name: true, legalEntityId: true, legalEntity: { select: { name: true, cui: true } } }
    });
    if (!worksite) throw new NotFoundException("Punctul de lucru nu există.");
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException("Data de final trebuie să fie după data de început.");
    }

    const number = trimOrNull(dto.number) ?? (await this.nextNumber(tenantId, startsAt));
    const duplicate = await this.prisma.ssmConvention.findFirst({ where: { tenantId, number }, select: { id: true } });
    if (duplicate) throw new BadRequestException(`Există deja o convenție cu numărul ${number}.`);

    const hostName = worksite.legalEntity?.name;
    const parties: Prisma.SsmConventionPartyCreateWithoutConventionInput[] = [];
    if (hostName) {
      parties.push({
        tenant: { connect: { id: tenantId } },
        isHost: true,
        companyName: hostName,
        cui: worksite.legalEntity?.cui ?? null,
        representativeName: trimOrNull(dto.coordinatorName) ?? "Reprezentant legal"
      });
    }
    for (const party of dto.parties ?? []) {
      parties.push({ tenant: { connect: { id: tenantId } }, isHost: false, ...this.partyData(party) });
    }

    const created = await this.prisma.ssmConvention.create({
      data: {
        tenant: { connect: { id: tenantId } },
        worksite: { connect: { id: worksite.id } },
        ...(worksite.legalEntityId ? { legalEntity: { connect: { id: worksite.legalEntityId } } } : {}),
        number,
        title: dto.title.trim(),
        startsAt,
        endsAt,
        ...this.clauseData(dto),
        createdBy: actorId,
        parties: { create: parties }
      },
      include: conventionInclude
    });

    await this.audit(tenantId, actorId, "SSM_CONVENTION_CREATED", created.id, {
      number,
      worksiteId: worksite.id,
      parties: parties.length
    });
    return this.map(created);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateSsmConventionDto) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt === null ? null : dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException("Data de final trebuie să fie după data de început.");
    }
    await this.prisma.$transaction([
      this.prisma.ssmConvention.update({
        where: { id },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          startsAt,
          endsAt,
          ...this.clauseData(dto, current)
        }
      }),
      this.clearSignatures(tenantId, id)
    ]);
    await this.audit(tenantId, actorId, "SSM_CONVENTION_UPDATED", id, { signaturesReset: current.parties.some((p) => p.signedAt) });
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    await this.prisma.ssmConvention.delete({ where: { id } });
    await this.audit(tenantId, actorId, "SSM_CONVENTION_DELETED", id, { number: current.number });
    return { deleted: true };
  }

  async addParty(tenantId: string, actorId: string, id: string, dto: CreateSsmConventionPartyDto) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const party = await this.prisma.ssmConventionParty.create({
      data: { tenantId, conventionId: id, isHost: false, ...this.partyData(dto) }
    });
    await this.prisma.$transaction([this.clearSignatures(tenantId, id)]);
    await this.audit(tenantId, actorId, "SSM_CONVENTION_PARTY_ADDED", id, { partyId: party.id, companyName: party.companyName });
    return this.get(tenantId, id);
  }

  async updateParty(tenantId: string, actorId: string, id: string, partyId: string, dto: UpdateSsmConventionPartyDto) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const party = current.parties.find((row) => row.id === partyId);
    if (!party) throw new NotFoundException("Partea nu există în această convenție.");
    await this.prisma.$transaction([
      this.prisma.ssmConventionParty.update({
        where: { id: partyId },
        data: {
          ...(dto.companyName !== undefined ? { companyName: dto.companyName.trim() } : {}),
          ...(dto.cui !== undefined ? { cui: trimOrNull(dto.cui) } : {}),
          ...(dto.representativeName !== undefined ? { representativeName: dto.representativeName.trim() } : {}),
          ...(dto.representativeFunction !== undefined
            ? { representativeFunction: trimOrNull(dto.representativeFunction) }
            : {}),
          ...(dto.ssmContactName !== undefined ? { ssmContactName: trimOrNull(dto.ssmContactName) } : {}),
          ...(dto.ssmContactPhone !== undefined ? { ssmContactPhone: trimOrNull(dto.ssmContactPhone) } : {}),
          ...(dto.ssmContactEmail !== undefined ? { ssmContactEmail: trimOrNull(dto.ssmContactEmail) } : {}),
          ...(dto.workersCount !== undefined ? { workersCount: dto.workersCount } : {}),
          ...(dto.obligations !== undefined ? { obligations: trimOrNull(dto.obligations) } : {})
        }
      }),
      this.clearSignatures(tenantId, id)
    ]);
    await this.audit(tenantId, actorId, "SSM_CONVENTION_PARTY_UPDATED", id, { partyId });
    return this.get(tenantId, id);
  }

  async removeParty(tenantId: string, actorId: string, id: string, partyId: string) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const party = current.parties.find((row) => row.id === partyId);
    if (!party) throw new NotFoundException("Partea nu există în această convenție.");
    if (party.isHost && current.parties.filter((row) => row.isHost).length === 1) {
      throw new BadRequestException("Beneficiarul (gazda) locului de muncă nu poate fi eliminat.");
    }
    await this.prisma.$transaction([
      this.prisma.ssmConventionParty.delete({ where: { id: partyId } }),
      this.clearSignatures(tenantId, id)
    ]);
    await this.audit(tenantId, actorId, "SSM_CONVENTION_PARTY_REMOVED", id, { partyId, companyName: party.companyName });
    return this.get(tenantId, id);
  }

  async signParty(tenantId: string, actorId: string, id: string, partyId: string, dto: SignSsmConventionPartyDto) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const party = current.parties.find((row) => row.id === partyId);
    if (!party) throw new NotFoundException("Partea nu există în această convenție.");
    if (!dto.signature.startsWith("data:image")) {
      throw new BadRequestException("Semnătura trebuie desenată în câmpul de semnătură.");
    }
    await this.prisma.ssmConventionParty.update({
      where: { id: partyId },
      data: { signature: dto.signature, signedAt: new Date() }
    });
    await this.audit(tenantId, actorId, "SSM_CONVENTION_PARTY_SIGNED", id, { partyId, companyName: party.companyName });
    return this.get(tenantId, id);
  }

  async activate(tenantId: string, actorId: string, id: string) {
    const current = await this.load(tenantId, id);
    this.assertDraft(current);
    const thirdParties = current.parties.filter((row) => !row.isHost);
    if (!current.parties.some((row) => row.isHost) || !thirdParties.length) {
      throw new BadRequestException("Convenția trebuie să aibă beneficiarul și cel puțin o firmă terță.");
    }
    const unsigned = current.parties.filter((row) => !row.signedAt);
    if (unsigned.length) {
      throw new BadRequestException(
        `Lipsesc semnăturile pentru: ${unsigned.map((row) => row.companyName).join(", ")}.`
      );
    }
    if (current.endsAt && current.endsAt.getTime() < Date.now()) {
      throw new BadRequestException("Convenția are data de final depășită.");
    }

    await this.prisma.ssmConvention.update({
      where: { id },
      data: { status: SsmConventionStatus.ACTIVE, activatedAt: new Date() }
    });
    const documentId = await this.publishPdf(tenantId, actorId, id, "Activare convenție (toate părțile au semnat)");
    await this.audit(tenantId, actorId, "SSM_CONVENTION_ACTIVATED", id, { number: current.number, documentId });
    return this.get(tenantId, id);
  }

  async terminate(tenantId: string, actorId: string, id: string, dto: TerminateSsmConventionDto) {
    const current = await this.load(tenantId, id);
    if (current.status !== SsmConventionStatus.ACTIVE) {
      throw new BadRequestException("Doar o convenție activă poate fi încetată.");
    }
    await this.prisma.ssmConvention.update({
      where: { id },
      data: {
        status: SsmConventionStatus.TERMINATED,
        terminatedAt: new Date(),
        terminationReason: trimOrNull(dto.reason)
      }
    });
    await this.publishPdf(tenantId, actorId, id, `Convenție încetată${dto.reason ? `: ${dto.reason}` : ""}`);
    await this.audit(tenantId, actorId, "SSM_CONVENTION_TERMINATED", id, { reason: dto.reason ?? null });
    return this.get(tenantId, id);
  }

  async pdf(tenantId: string, id: string) {
    const row = await this.load(tenantId, id);
    return { buffer: await this.render(row), fileName: `Conventie-SSM-${safeFileName(row.number)}.pdf` };
  }

  /** Cron zilnic: expiră convențiile depășite și anunță coordonatorul cu 30 de zile înainte de final. */
  async dispatchReminders(tenantId: string, actorId: string) {
    const expired = await this.expireOutdated(tenantId, actorId);
    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRY_REMINDER_DAYS * DAY_MS);
    const expiring = await this.prisma.ssmConvention.findMany({
      where: {
        tenantId,
        status: SsmConventionStatus.ACTIVE,
        endsAt: { gte: now, lte: horizon },
        expiryReminderSentAt: null
      },
      include: conventionInclude
    });

    let reminded = 0;
    for (const row of expiring) {
      const recipients = new Set<string>();
      if (row.coordinatorEmail) recipients.add(row.coordinatorEmail);
      for (const party of row.parties) {
        if (party.ssmContactEmail) recipients.add(party.ssmContactEmail);
      }
      const days = Math.max(0, Math.ceil(((row.endsAt?.getTime() ?? now.getTime()) - now.getTime()) / DAY_MS));
      const subject = `Convenția SSM ${row.number} expiră în ${days} zile`;
      const text = [
        `Convenția SSM nr. ${row.number} — ${row.title}`,
        `Loc de muncă: ${row.worksite.name}`,
        `Data de final: ${row.endsAt?.toLocaleDateString("ro-RO") ?? "—"}`,
        "",
        "Dacă lucrările continuă, încheiați o convenție nouă sau prelungiți termenul înainte de expirare.",
        `Părți: ${row.parties.map((party) => party.companyName).join(", ")}`
      ].join("\n");
      for (const to of recipients) {
        try {
          await this.mailService.sendMail({ to, subject, text });
        } catch {
          // un destinatar invalid nu trebuie să blocheze ceilalți destinatari
        }
      }
      await this.prisma.ssmConvention.update({ where: { id: row.id }, data: { expiryReminderSentAt: now } });
      await this.audit(tenantId, actorId, "SSM_CONVENTION_EXPIRY_REMINDER", row.id, {
        recipients: recipients.size,
        days
      });
      reminded += 1;
    }
    return { expired, reminded };
  }

  private async expireOutdated(tenantId: string, actorId: string) {
    const now = new Date();
    const outdated = await this.prisma.ssmConvention.findMany({
      where: { tenantId, status: SsmConventionStatus.ACTIVE, endsAt: { lt: now } },
      select: { id: true, number: true }
    });
    if (!outdated.length) return 0;
    await this.prisma.ssmConvention.updateMany({
      where: { tenantId, id: { in: outdated.map((row) => row.id) } },
      data: { status: SsmConventionStatus.EXPIRED }
    });
    for (const row of outdated) {
      await this.audit(tenantId, actorId, "SSM_CONVENTION_EXPIRED", row.id, { number: row.number });
    }
    return outdated.length;
  }

  private async uncoveredCompanies(tenantId: string, worksiteId?: string) {
    const since = new Date(Date.now() - UNCOVERED_LOOKBACK_DAYS * DAY_MS);
    const visits = await this.prisma.ssmGateVisit.findMany({
      where: {
        tenantId,
        visitDate: { gte: since },
        companyName: { not: null },
        worksiteId: worksiteId ? worksiteId : { not: null }
      },
      select: { companyName: true, worksiteId: true, visitDate: true, worksite: { select: { name: true } } }
    });
    if (!visits.length) return [];

    const active = await this.prisma.ssmConvention.findMany({
      where: { tenantId, status: SsmConventionStatus.ACTIVE },
      select: { worksiteId: true, parties: { select: { companyName: true } } }
    });
    const covered = new Set<string>();
    for (const convention of active) {
      for (const party of convention.parties) {
        covered.add(`${convention.worksiteId}|${normalizeCompany(party.companyName)}`);
      }
    }

    const groups = new Map<
      string,
      { companyName: string; worksiteId: string; worksiteName: string; visits: number; lastVisitAt: Date }
    >();
    for (const visit of visits) {
      const companyName = visit.companyName?.trim();
      if (!companyName || !visit.worksiteId) continue;
      const key = `${visit.worksiteId}|${normalizeCompany(companyName)}`;
      if (covered.has(key)) continue;
      const group = groups.get(key);
      if (group) {
        group.visits += 1;
        if (visit.visitDate > group.lastVisitAt) group.lastVisitAt = visit.visitDate;
      } else {
        groups.set(key, {
          companyName,
          worksiteId: visit.worksiteId,
          worksiteName: visit.worksite?.name ?? "—",
          visits: 1,
          lastVisitAt: visit.visitDate
        });
      }
    }
    return [...groups.values()]
      .sort((a, b) => b.visits - a.visits || b.lastVisitAt.getTime() - a.lastVisitAt.getTime())
      .map((group) => ({ ...group, lastVisitAt: group.lastVisitAt.toISOString() }));
  }

  private async publishPdf(tenantId: string, actorId: string, id: string, changeNote: string) {
    const row = await this.load(tenantId, id);
    const buffer = await this.render(row);
    const result = await this.documentsService.upsertGeneratedPdf(tenantId, actorId, {
      type: SsmDocumentType.SSM_CONVENTION,
      title: `Convenție SSM nr. ${row.number} — ${row.title}`,
      targetType: SsmDocumentTargetType.WORKSITE,
      targetRefId: row.worksiteId,
      targetLabel: row.worksite.name,
      entityName: row.legalEntity?.name ?? undefined,
      legalEntityId: row.legalEntityId ?? undefined,
      fileName: `Conventie-SSM-${safeFileName(row.number)}.pdf`,
      buffer,
      changeNote,
      isControlFolder: true,
      matchDocumentId: row.documentId ?? null
    });
    if (row.documentId !== result.documentId) {
      await this.prisma.ssmConvention.update({ where: { id }, data: { documentId: result.documentId } });
    }
    return result.documentId;
  }

  private render(row: ConventionRow) {
    return renderSsmConvention({
      number: row.number,
      title: row.title,
      status: row.status,
      worksiteName: row.worksite.name,
      worksiteAddress: row.worksite.address,
      activityDescription: row.activityDescription,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      coordinatorName: row.coordinatorName,
      coordinatorFunction: row.coordinatorFunction,
      coordinatorEmail: row.coordinatorEmail,
      sharedRisks: row.sharedRisks,
      preventionMeasures: row.preventionMeasures,
      emergencyArrangements: row.emergencyArrangements,
      trainingArrangements: row.trainingArrangements,
      eipArrangements: row.eipArrangements,
      notes: row.notes,
      parties: row.parties
    });
  }

  private async nextNumber(tenantId: string, startsAt: Date) {
    const year = startsAt.getFullYear();
    const prefix = `CONV-${year}-`;
    const count = await this.prisma.ssmConvention.count({ where: { tenantId, number: { startsWith: prefix } } });
    for (let index = count + 1; index < count + 50; index += 1) {
      const candidate = `${prefix}${String(index).padStart(3, "0")}`;
      const taken = await this.prisma.ssmConvention.findFirst({ where: { tenantId, number: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${prefix}${Date.now()}`;
  }

  private partyData(dto: CreateSsmConventionPartyDto) {
    return {
      companyName: dto.companyName.trim(),
      cui: trimOrNull(dto.cui),
      representativeName: dto.representativeName.trim(),
      representativeFunction: trimOrNull(dto.representativeFunction),
      ssmContactName: trimOrNull(dto.ssmContactName),
      ssmContactPhone: trimOrNull(dto.ssmContactPhone),
      ssmContactEmail: trimOrNull(dto.ssmContactEmail),
      workersCount: dto.workersCount ?? null,
      obligations: trimOrNull(dto.obligations)
    };
  }

  private clauseData(dto: UpdateSsmConventionDto | CreateSsmConventionDto, current?: ConventionRow) {
    const pick = (value: string | undefined, fallback: string | null | undefined) =>
      value !== undefined ? trimOrNull(value) : (fallback ?? null);
    return {
      activityDescription: pick(dto.activityDescription, current?.activityDescription),
      sharedRisks: pick(dto.sharedRisks, current?.sharedRisks),
      preventionMeasures: pick(dto.preventionMeasures, current?.preventionMeasures),
      emergencyArrangements: pick(dto.emergencyArrangements, current?.emergencyArrangements),
      trainingArrangements: pick(dto.trainingArrangements, current?.trainingArrangements),
      eipArrangements: pick(dto.eipArrangements, current?.eipArrangements),
      coordinatorName: pick(dto.coordinatorName, current?.coordinatorName),
      coordinatorFunction: pick(dto.coordinatorFunction, current?.coordinatorFunction),
      coordinatorEmail: pick(dto.coordinatorEmail, current?.coordinatorEmail),
      notes: pick(dto.notes, current?.notes)
    };
  }

  private clearSignatures(tenantId: string, conventionId: string) {
    return this.prisma.ssmConventionParty.updateMany({
      where: { tenantId, conventionId, signedAt: { not: null } },
      data: { signature: null, signedAt: null }
    });
  }

  private assertDraft(row: ConventionRow) {
    if (row.status !== SsmConventionStatus.DRAFT) {
      throw new BadRequestException("Convenția nu mai este în ciornă și nu poate fi modificată.");
    }
  }

  private async load(tenantId: string, id: string): Promise<ConventionRow> {
    const row = await this.prisma.ssmConvention.findFirst({ where: { id, tenantId }, include: conventionInclude });
    if (!row) throw new NotFoundException("Convenția nu există.");
    return row;
  }

  private map(row: ConventionRow) {
    const signedCount = row.parties.filter((party) => party.signedAt).length;
    const daysUntilEnd = row.endsAt ? Math.ceil((row.endsAt.getTime() - Date.now()) / DAY_MS) : null;
    return {
      id: row.id,
      worksiteId: row.worksiteId,
      worksiteName: row.worksite.name,
      legalEntityId: row.legalEntityId,
      legalEntityName: row.legalEntity?.name ?? null,
      number: row.number,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      daysUntilEnd,
      status: row.status,
      activityDescription: row.activityDescription,
      sharedRisks: row.sharedRisks,
      preventionMeasures: row.preventionMeasures,
      emergencyArrangements: row.emergencyArrangements,
      trainingArrangements: row.trainingArrangements,
      eipArrangements: row.eipArrangements,
      coordinatorName: row.coordinatorName,
      coordinatorFunction: row.coordinatorFunction,
      coordinatorEmail: row.coordinatorEmail,
      notes: row.notes,
      documentId: row.documentId,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      terminatedAt: row.terminatedAt?.toISOString() ?? null,
      terminationReason: row.terminationReason,
      parties: row.parties.map((party) => ({
        id: party.id,
        isHost: party.isHost,
        companyName: party.companyName,
        cui: party.cui,
        representativeName: party.representativeName,
        representativeFunction: party.representativeFunction,
        ssmContactName: party.ssmContactName,
        ssmContactPhone: party.ssmContactPhone,
        ssmContactEmail: party.ssmContactEmail,
        workersCount: party.workersCount,
        obligations: party.obligations,
        signed: Boolean(party.signedAt),
        signedAt: party.signedAt?.toISOString() ?? null
      })),
      signedCount,
      readyToActivate:
        row.status === SsmConventionStatus.DRAFT &&
        row.parties.length >= 2 &&
        row.parties.some((party) => party.isHost) &&
        signedCount === row.parties.length
    };
  }

  private audit(tenantId: string, actorId: string, action: string, entityId: string, payload: Prisma.InputJsonObject) {
    return this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action,
      entityType: "SsmConvention",
      entityId,
      payload
    });
  }
}
