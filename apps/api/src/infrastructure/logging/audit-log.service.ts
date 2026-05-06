import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface AuditInput {
  tenantId: string;
  actorId: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload as object | undefined
      }
    });
  }
}
