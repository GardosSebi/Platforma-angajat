import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto, resolvePagination } from "../../common/dto/pagination-query.dto";
import { paginatedResult } from "../../common/pagination";

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

  async list(tenantId: string, query?: PaginationQueryDto & { module?: string }) {
    const p = resolvePagination(query);
    const where = {
      tenantId,
      ...(query?.module?.trim() ? { module: query.module.trim() } : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take
      }),
      this.prisma.auditLog.count({ where })
    ]);
    const actorIds = [...new Set(rows.map((row) => row.actorId))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { tenantId, id: { in: actorIds } },
          select: { id: true, email: true, fullName: true }
        })
      : [];
    const actorMap = new Map(actors.map((user) => [user.id, user]));
    const items = rows.map((row) => {
      const actor = actorMap.get(row.actorId);
      return {
        id: row.id,
        actorId: row.actorId,
        actorEmail: actor?.email ?? (row.actorId === "system-cron" ? "system-cron" : null),
        actorName: actor?.fullName ?? (row.actorId === "system-cron" ? "Job sistem" : null),
        module: row.module,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload,
        createdAt: row.createdAt.toISOString()
      };
    });
    return paginatedResult(items, total, p.page, p.pageSize);
  }

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
