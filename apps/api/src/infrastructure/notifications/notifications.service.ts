import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type NotifyUserInput = {
  tenantId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  linkPath?: string;
  entityType?: string;
  entityId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserIdForEmployee(tenantId: string, employeeId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, active: true },
      select: { email: true }
    });
    if (!employee?.email) return null;
    return this.findUserIdByEmail(tenantId, employee.email);
  }

  async findUserIdByEmail(tenantId: string, email: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase(), active: true },
      select: { id: true }
    });
    return user?.id ?? null;
  }

  async notifyUser(input: NotifyUserInput) {
    return this.prisma.inAppNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        category: input.category,
        title: input.title,
        body: input.body,
        linkPath: input.linkPath,
        entityType: input.entityType,
        entityId: input.entityId
      }
    });
  }

  async notifyEmployee(input: Omit<NotifyUserInput, "userId"> & { employeeId: string }) {
    const userId = await this.findUserIdForEmployee(input.tenantId, input.employeeId);
    if (!userId) return null;
    return this.notifyUser({ ...input, userId });
  }

  async notifyEmployeeByEmail(
    tenantId: string,
    email: string,
    payload: Omit<NotifyUserInput, "tenantId" | "userId">
  ) {
    const userId = await this.findUserIdByEmail(tenantId, email);
    if (!userId) return null;
    return this.notifyUser({ tenantId, userId, ...payload });
  }

  async listForUser(tenantId: string, userId: string, unreadOnly = false, limit = 50) {
    const rows = await this.prisma.inAppNotification.findMany({
      where: {
        tenantId,
        userId,
        ...(unreadOnly ? { readAt: null } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    const unreadCount = await this.prisma.inAppNotification.count({
      where: { tenantId, userId, readAt: null }
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        category: row.category,
        title: row.title,
        body: row.body,
        linkPath: row.linkPath,
        entityType: row.entityType,
        entityId: row.entityId,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString()
      })),
      unreadCount
    };
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    const updated = await this.prisma.inAppNotification.updateMany({
      where: { id: notificationId, tenantId, userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { updated: updated.count > 0 };
  }

  async markAllRead(tenantId: string, userId: string) {
    const updated = await this.prisma.inAppNotification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { updated: updated.count };
  }
}
