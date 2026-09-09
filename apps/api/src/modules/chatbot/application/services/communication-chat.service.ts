import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommunicationChatChannelKind,
  CommunicationPublishScope,
  ExternalContactKind,
  SystemRole
} from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { MailService } from "../../../../infrastructure/mail/mail.service";
import { CommunicationRightsService } from "./communication-rights.service";
import { JwtPayload } from "../../../../auth/jwt.strategy";

export class CreateExternalContactDto {
  @IsOptional()
  @IsEnum(ExternalContactKind)
  kind?: ExternalContactKind;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  organization!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PostChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

@Injectable()
export class CommunicationChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rights: CommunicationRightsService,
    private readonly mail: MailService,
    private readonly auditLog: AuditLogService
  ) {}

  async listContacts(tenantId: string, viewer: JwtPayload) {
    const caps = await this.rights.myCapabilities(tenantId, viewer.sub, viewer.roles ?? []);
    if (!caps.canCommunicateExternal) {
      return { items: [] };
    }
    const items = await this.prisma.externalContact.findMany({
      where: { tenantId },
      orderBy: [{ organization: "asc" }, { fullName: "asc" }]
    });
    return { items: items.map((row) => this.mapContact(row)) };
  }

  async createContact(tenantId: string, actorId: string, dto: CreateExternalContactDto, viewer: JwtPayload) {
    await this.rights.assertCanCommunicateExternal(tenantId, viewer.sub, viewer.roles ?? []);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.externalContact.findFirst({ where: { tenantId, email } });
    if (existing) {
      throw new BadRequestException("Există deja un contact extern cu acest email.");
    }
    const row = await this.prisma.externalContact.create({
      data: {
        tenantId,
        kind: dto.kind ?? ExternalContactKind.PARTNER,
        organization: dto.organization.trim(),
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        active: dto.active ?? true,
        createdByUserId: actorId
      }
    });
    await this.ensureExternalChannel(tenantId, actorId, row.id, `${row.organization} — ${row.fullName}`);
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "COMMUNICATIONS",
      action: "EXTERNAL_CONTACT_CREATED",
      entityType: "ExternalContact",
      entityId: row.id,
      payload: { email, kind: row.kind }
    });
    return this.mapContact(row);
  }

  async removeContact(tenantId: string, id: string, viewer: JwtPayload) {
    await this.rights.assertCanCommunicateExternal(tenantId, viewer.sub, viewer.roles ?? []);
    const existing = await this.prisma.externalContact.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Contactul extern nu a fost găsit.");
    await this.prisma.externalContact.update({ where: { id }, data: { active: false } });
    return { deactivated: true };
  }

  async listChannels(tenantId: string, viewer: JwtPayload) {
    await this.ensureInternalChannels(tenantId, viewer);
    const caps = await this.rights.myCapabilities(tenantId, viewer.sub, viewer.roles ?? []);
    if (caps.canCommunicateExternal) {
      const contacts = await this.prisma.externalContact.findMany({
        where: { tenantId, active: true }
      });
      for (const contact of contacts) {
        await this.ensureExternalChannel(
          tenantId,
          viewer.sub,
          contact.id,
          `${contact.organization} — ${contact.fullName}`
        );
      }
    }

    const channels = await this.prisma.communicationChatChannel.findMany({
      where: { tenantId },
      include: {
        externalContact: { select: { id: true, fullName: true, organization: true, email: true, active: true } }
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }]
    });

    const visible = [];
    for (const channel of channels) {
      if (channel.kind === CommunicationChatChannelKind.EXTERNAL && !channel.externalContact?.active) {
        continue;
      }
      try {
        await this.rights.assertCanChatOnChannel(tenantId, viewer.sub, viewer.roles ?? [], channel);
        visible.push(channel);
      } catch {
        continue;
      }
    }

    return {
      items: visible.map((channel) => ({
        id: channel.id,
        kind: channel.kind,
        name: channel.name,
        legalEntityId: channel.legalEntityId,
        employeeGroupId: channel.employeeGroupId,
        worksiteId: channel.worksiteId,
        externalContactId: channel.externalContactId,
        externalContact: channel.externalContact
          ? {
              id: channel.externalContact.id,
              fullName: channel.externalContact.fullName,
              organization: channel.externalContact.organization,
              email: channel.externalContact.email
            }
          : null,
        updatedAt: channel.updatedAt.toISOString()
      }))
    };
  }

  async listMessages(tenantId: string, channelId: string, viewer: JwtPayload) {
    const channel = await this.assertChannel(tenantId, channelId);
    await this.rights.assertCanChatOnChannel(tenantId, viewer.sub, viewer.roles ?? [], channel);
    const rows = await this.prisma.communicationChatMessage.findMany({
      where: { tenantId, channelId },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 200
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        channelId: row.channelId,
        authorUserId: row.authorUserId,
        authorName: row.author.fullName || row.author.email,
        body: row.body,
        emailedTo: row.emailedTo,
        createdAt: row.createdAt.toISOString(),
        mine: row.authorUserId === viewer.sub
      }))
    };
  }

  async postMessage(tenantId: string, channelId: string, dto: PostChatMessageDto, viewer: JwtPayload) {
    const channel = await this.assertChannel(tenantId, channelId);
    await this.rights.assertCanChatOnChannel(tenantId, viewer.sub, viewer.roles ?? [], channel);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Mesajul nu poate fi gol.");

    let emailedTo: string | null = null;
    if (channel.kind === CommunicationChatChannelKind.EXTERNAL && channel.externalContactId) {
      const contact = await this.prisma.externalContact.findFirst({
        where: { id: channel.externalContactId, tenantId, active: true }
      });
      if (!contact) throw new NotFoundException("Contactul extern nu mai este activ.");
      const author = await this.prisma.user.findFirst({
        where: { id: viewer.sub, tenantId },
        select: { fullName: true, email: true }
      });
      const fromName = author?.fullName || author?.email || "Platforma Employee";
      await this.mail.sendMail({
        to: contact.email,
        subject: `Mesaj de la ${fromName} — ${channel.name}`,
        text: `${body}\n\n— ${fromName}\nAcest mesaj a fost trimis din platforma internă către un partener/contractant extern.`
      });
      emailedTo = contact.email;
    }

    const created = await this.prisma.communicationChatMessage.create({
      data: {
        tenantId,
        channelId,
        authorUserId: viewer.sub,
        body,
        emailedTo
      },
      include: { author: { select: { id: true, fullName: true, email: true } } }
    });
    await this.prisma.communicationChatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() }
    });
    await this.auditLog.write({
      tenantId,
      actorId: viewer.sub,
      module: "COMMUNICATIONS",
      action: channel.kind === "EXTERNAL" ? "EXTERNAL_CHAT_SENT" : "CHAT_MESSAGE_SENT",
      entityType: "CommunicationChatChannel",
      entityId: channelId,
      payload: { emailedTo }
    });
    return {
      id: created.id,
      channelId: created.channelId,
      authorUserId: created.authorUserId,
      authorName: created.author.fullName || created.author.email,
      body: created.body,
      emailedTo: created.emailedTo,
      createdAt: created.createdAt.toISOString(),
      mine: true
    };
  }

  private async ensureInternalChannels(tenantId: string, viewer: JwtPayload) {
    const isAdmin =
      (viewer.roles ?? []).includes(SystemRole.SSM_ADMIN) ||
      (viewer.roles ?? []).includes(SystemRole.SSM_ENTITY_RESPONSIBLE);
    const scopes = isAdmin
      ? await this.prisma.communicationPublishRight.findMany({
          where: { tenantId },
          include: {
            legalEntity: { select: { id: true, code: true, name: true } },
            employeeGroup: { select: { id: true, name: true } },
            worksite: { select: { id: true, code: true, name: true } }
          }
        })
      : await this.rights.listChatScopes(tenantId, viewer.sub, viewer.roles ?? []);

    if (isAdmin || scopes.some((s) => s.scopeType === CommunicationPublishScope.ALL)) {
      await this.ensureChannel(tenantId, viewer.sub, {
        kind: CommunicationChatChannelKind.ALL,
        name: "Chat organizație"
      });
    }

    for (const scope of scopes) {
      if (!isAdmin && !scope.canChat) continue;
      if (scope.scopeType === CommunicationPublishScope.LEGAL_ENTITY && scope.legalEntityId) {
        const name = scope.legalEntity
          ? `Companie: ${scope.legalEntity.code} — ${scope.legalEntity.name}`
          : "Chat companie";
        await this.ensureChannel(tenantId, viewer.sub, {
          kind: CommunicationChatChannelKind.COMPANY,
          name,
          legalEntityId: scope.legalEntityId
        });
      }
      if (scope.scopeType === CommunicationPublishScope.EMPLOYEE_GROUP && scope.employeeGroupId) {
        const name = scope.employeeGroup ? `Grup: ${scope.employeeGroup.name}` : "Chat grup";
        await this.ensureChannel(tenantId, viewer.sub, {
          kind: CommunicationChatChannelKind.GROUP,
          name,
          employeeGroupId: scope.employeeGroupId
        });
      }
      if (scope.scopeType === CommunicationPublishScope.WORKSITE && scope.worksiteId) {
        const name = scope.worksite
          ? `Punct: ${scope.worksite.code} — ${scope.worksite.name}`
          : "Chat punct de lucru";
        await this.ensureChannel(tenantId, viewer.sub, {
          kind: CommunicationChatChannelKind.WORKSITE,
          name,
          worksiteId: scope.worksiteId
        });
      }
    }
  }

  private async ensureChannel(
    tenantId: string,
    actorId: string,
    data: {
      kind: CommunicationChatChannelKind;
      name: string;
      legalEntityId?: string;
      employeeGroupId?: string;
      worksiteId?: string;
      externalContactId?: string;
    }
  ) {
    const existing = await this.prisma.communicationChatChannel.findFirst({
      where: {
        tenantId,
        kind: data.kind,
        legalEntityId: data.legalEntityId ?? null,
        employeeGroupId: data.employeeGroupId ?? null,
        worksiteId: data.worksiteId ?? null,
        externalContactId: data.externalContactId ?? null
      }
    });
    if (existing) return existing;
    return this.prisma.communicationChatChannel.create({
      data: {
        tenantId,
        kind: data.kind,
        name: data.name,
        legalEntityId: data.legalEntityId ?? null,
        employeeGroupId: data.employeeGroupId ?? null,
        worksiteId: data.worksiteId ?? null,
        externalContactId: data.externalContactId ?? null,
        createdByUserId: actorId
      }
    });
  }

  private async ensureExternalChannel(tenantId: string, actorId: string, contactId: string, name: string) {
    return this.ensureChannel(tenantId, actorId, {
      kind: CommunicationChatChannelKind.EXTERNAL,
      name,
      externalContactId: contactId
    });
  }

  private async assertChannel(tenantId: string, id: string) {
    const channel = await this.prisma.communicationChatChannel.findFirst({
      where: { id, tenantId },
      include: { externalContact: true }
    });
    if (!channel) throw new NotFoundException("Canalul de chat nu a fost găsit.");
    return channel;
  }

  private mapContact(row: {
    id: string;
    kind: ExternalContactKind;
    organization: string;
    fullName: string;
    email: string;
    phone: string | null;
    notes: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      kind: row.kind,
      organization: row.organization,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}