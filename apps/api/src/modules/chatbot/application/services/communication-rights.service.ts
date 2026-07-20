import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CommunicationAudienceType, CommunicationPublishScope, SystemRole } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";

export type CreatePublishRightInput = {
  userId: string;
  scopeType: CommunicationPublishScope;
  legalEntityId?: string | null;
  employeeGroupId?: string | null;
  worksiteId?: string | null;
  canPublish?: boolean;
  canManageTemplates?: boolean;
};

@Injectable()
export class CommunicationRightsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.communicationPublishRight.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        legalEntity: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, name: true } },
        worksite: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, actorUserId: string, input: CreatePublishRightInput) {
    await this.assertRefs(tenantId, input);
    const user = await this.prisma.user.findFirst({ where: { id: input.userId, tenantId } });
    if (!user) throw new NotFoundException("Utilizatorul nu a fost găsit.");

    return this.prisma.communicationPublishRight.create({
      data: {
        tenantId,
        userId: input.userId,
        scopeType: input.scopeType,
        legalEntityId: input.scopeType === "LEGAL_ENTITY" ? input.legalEntityId ?? null : null,
        employeeGroupId: input.scopeType === "EMPLOYEE_GROUP" ? input.employeeGroupId ?? null : null,
        worksiteId: input.scopeType === "WORKSITE" ? input.worksiteId ?? null : null,
        canPublish: input.canPublish ?? true,
        canManageTemplates: input.canManageTemplates ?? false,
        createdByUserId: actorUserId
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        legalEntity: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, name: true } },
        worksite: { select: { id: true, code: true, name: true } }
      }
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.communicationPublishRight.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Dreptul de comunicare nu a fost găsit.");
    await this.prisma.communicationPublishRight.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * SSM_ADMIN bypasses. Otherwise user must have a matching publish right for the audience.
   */
  async assertCanPublish(
    tenantId: string,
    userId: string,
    roles: string[],
    audienceType: CommunicationAudienceType,
    audienceRefId?: string | null
  ) {
    if (roles.includes(SystemRole.SSM_ADMIN)) return;

    const tenantRightsCount = await this.prisma.communicationPublishRight.count({ where: { tenantId } });
    // Soft rollout: if no rights configured yet, keep legacy RBAC-only behavior.
    if (tenantRightsCount === 0) return;

    const rights = await this.prisma.communicationPublishRight.findMany({
      where: { tenantId, userId, canPublish: true }
    });
    if (!rights.length) {
      throw new ForbiddenException(
        "Nu ai drepturi de publicare configurate. Cere administratorului un drept pe companie/grup/punct."
      );
    }

    if (rights.some((r) => r.scopeType === CommunicationPublishScope.ALL)) return;

    if (audienceType === CommunicationAudienceType.ALL) {
      throw new ForbiddenException("Nu poți publica către toți angajații fără drept pe scopul ALL.");
    }

    if (audienceType === CommunicationAudienceType.WORKSITE && audienceRefId) {
      const ok = rights.some(
        (r) =>
          r.scopeType === CommunicationPublishScope.WORKSITE && r.worksiteId === audienceRefId
      );
      if (ok) return;

      const worksite = await this.prisma.worksite.findFirst({
        where: { id: audienceRefId, tenantId },
        select: { legalEntityId: true }
      });
      if (
        worksite?.legalEntityId &&
        rights.some(
          (r) =>
            r.scopeType === CommunicationPublishScope.LEGAL_ENTITY &&
            r.legalEntityId === worksite.legalEntityId
        )
      ) {
        return;
      }
    }

    if (audienceType === CommunicationAudienceType.EMPLOYEE_GROUP && audienceRefId) {
      const ok = rights.some(
        (r) =>
          r.scopeType === CommunicationPublishScope.EMPLOYEE_GROUP &&
          r.employeeGroupId === audienceRefId
      );
      if (ok) return;
    }

    if (
      (audienceType === CommunicationAudienceType.DEPARTMENT ||
        audienceType === CommunicationAudienceType.JOB_POSITION ||
        audienceType === CommunicationAudienceType.EMPLOYEE ||
        audienceType === CommunicationAudienceType.CUSTOM) &&
      audienceRefId
    ) {
      if (
        rights.some(
          (r) =>
            r.scopeType === CommunicationPublishScope.LEGAL_ENTITY ||
            r.scopeType === CommunicationPublishScope.WORKSITE
        )
      ) {
        return;
      }
    }

    throw new ForbiddenException("Audiența selectată nu este acoperită de drepturile tale de comunicare.");
  }

  async assertCanManageTemplates(tenantId: string, userId: string, roles: string[]) {
    if (roles.includes(SystemRole.SSM_ADMIN)) return;
    const tenantRightsCount = await this.prisma.communicationPublishRight.count({ where: { tenantId } });
    if (tenantRightsCount === 0) return;
    const count = await this.prisma.communicationPublishRight.count({
      where: { tenantId, userId, canManageTemplates: true }
    });
    if (!count) {
      throw new ForbiddenException("Nu ai drept de administrare șabloane comunicare.");
    }
  }

  private async assertRefs(tenantId: string, input: CreatePublishRightInput) {
    if (input.scopeType === CommunicationPublishScope.ALL) return;

    if (input.scopeType === CommunicationPublishScope.LEGAL_ENTITY) {
      if (!input.legalEntityId?.trim()) {
        throw new BadRequestException("Compania (legal entity) este obligatorie pentru acest scop.");
      }
      const entity = await this.prisma.legalEntity.findFirst({
        where: { id: input.legalEntityId, tenantId }
      });
      if (!entity) throw new NotFoundException("Compania nu a fost găsită.");
      return;
    }

    if (input.scopeType === CommunicationPublishScope.EMPLOYEE_GROUP) {
      if (!input.employeeGroupId?.trim()) {
        throw new BadRequestException("Grupul de angajați este obligatoriu pentru acest scop.");
      }
      const group = await this.prisma.employeeGroup.findFirst({
        where: { id: input.employeeGroupId, tenantId }
      });
      if (!group) throw new NotFoundException("Grupul nu a fost găsit.");
      return;
    }

    if (input.scopeType === CommunicationPublishScope.WORKSITE) {
      if (!input.worksiteId?.trim()) {
        throw new BadRequestException("Punctul de lucru este obligatoriu pentru acest scop.");
      }
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: input.worksiteId, tenantId }
      });
      if (!worksite) throw new NotFoundException("Punctul de lucru nu a fost găsit.");
    }
  }
}
