import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SsmEipMovementType } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { CreateEipMovementDto, CreateEipNormDto, CreateEipTypeDto } from "../../api/dto/ssm-eip.dto";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return d;
}

@Injectable()
export class SsmEipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async listTypes(tenantId: string) {
    return this.prisma.ssmEipType.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async createType(tenantId: string, actorId: string, dto: CreateEipTypeDto) {
    const created = await this.prisma.ssmEipType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        defaultLifetimeDays: dto.defaultLifetimeDays
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_TYPE_CREATED",
      entityType: "SsmEipType",
      entityId: created.id
    });
    return created;
  }

  async listNorms(tenantId: string) {
    const rows = await this.prisma.ssmEipNorm.findMany({
      where: { tenantId },
      include: {
        jobPosition: { select: { name: true } },
        eipType: { select: { name: true } }
      },
      orderBy: [{ jobPosition: { name: "asc" } }]
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        jobPositionId: row.jobPositionId,
        jobPositionName: row.jobPosition.name,
        eipTypeId: row.eipTypeId,
        eipTypeName: row.eipType.name,
        requiredQuantity: row.requiredQuantity,
        lifetimeDays: row.lifetimeDays,
        replacementRule: row.replacementRule
      }))
    };
  }

  async upsertNorm(tenantId: string, actorId: string, dto: CreateEipNormDto) {
    const job = await this.prisma.jobPosition.findFirst({
      where: { id: dto.jobPositionId, tenantId, active: true }
    });
    if (!job) throw new NotFoundException("Invalid jobPositionId for tenant.");
    const type = await this.prisma.ssmEipType.findFirst({
      where: { id: dto.eipTypeId, tenantId, active: true }
    });
    if (!type) throw new NotFoundException("Invalid eipTypeId for tenant.");

    const norm = await this.prisma.ssmEipNorm.upsert({
      where: {
        jobPositionId_eipTypeId: {
          jobPositionId: dto.jobPositionId,
          eipTypeId: dto.eipTypeId
        }
      },
      create: {
        tenantId,
        jobPositionId: dto.jobPositionId,
        eipTypeId: dto.eipTypeId,
        requiredQuantity: dto.requiredQuantity,
        lifetimeDays: dto.lifetimeDays,
        replacementRule: dto.replacementRule?.trim(),
        createdBy: actorId
      },
      update: {
        requiredQuantity: dto.requiredQuantity,
        lifetimeDays: dto.lifetimeDays,
        replacementRule: dto.replacementRule?.trim()
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_NORM_UPSERTED",
      entityType: "SsmEipNorm",
      entityId: norm.id
    });
    return norm;
  }

  async registerMovement(tenantId: string, actorId: string, dto: CreateEipMovementDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, active: true }
    });
    if (!employee) throw new NotFoundException("Employee not found.");
    const type = await this.prisma.ssmEipType.findFirst({
      where: { id: dto.eipTypeId, tenantId, active: true }
    });
    if (!type) throw new NotFoundException("EIP type not found.");

    const dueAt =
      parseOptionalDate(dto.replacementDueAt) ??
      (type.defaultLifetimeDays ? new Date(Date.now() + type.defaultLifetimeDays * 24 * 60 * 60 * 1000) : undefined);

    const stock = await this.prisma.ssmEipStock.upsert({
      where: { tenantId_eipTypeId: { tenantId, eipTypeId: dto.eipTypeId } },
      create: {
        tenantId,
        eipTypeId: dto.eipTypeId,
        quantityOnHand: 0,
        minimumThreshold: 0
      },
      update: {}
    });

    let stockDelta = 0;
    if (dto.movementType === SsmEipMovementType.DISTRIBUTION) stockDelta = -dto.quantity;
    if (dto.movementType === SsmEipMovementType.RETURN) stockDelta = dto.quantity;
    if (dto.movementType === SsmEipMovementType.SCRAP) stockDelta = -dto.quantity;
    if (stock.quantityOnHand + stockDelta < 0) {
      throw new BadRequestException("Insufficient stock for this movement.");
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.ssmEipStock.update({
        where: { id: stock.id },
        data: { quantityOnHand: stock.quantityOnHand + stockDelta }
      });
      return tx.ssmEipMovement.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          eipTypeId: dto.eipTypeId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          replacementDueAt: dueAt,
          signatureData: dto.signatureData,
          signedAt: dto.signatureData ? new Date() : null,
          notes: dto.notes?.trim(),
          createdBy: actorId
        }
      });
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "EIP_MOVEMENT_REGISTERED",
      entityType: "SsmEipMovement",
      entityId: movement.id,
      payload: { movementType: dto.movementType, quantity: dto.quantity }
    });

    return movement;
  }

  async movementRegister(tenantId: string) {
    const rows = await this.prisma.ssmEipMovement.findMany({
      where: { tenantId },
      include: {
        employee: { select: { fullName: true } },
        eipType: { select: { name: true } }
      },
      orderBy: { movementDate: "desc" },
      take: 200
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.fullName,
        eipTypeId: row.eipTypeId,
        eipTypeName: row.eipType.name,
        movementType: row.movementType,
        quantity: row.quantity,
        movementDate: row.movementDate,
        replacementDueAt: row.replacementDueAt,
        signedAt: row.signedAt,
        notes: row.notes
      }))
    };
  }

  async dueNotifications(tenantId: string) {
    const rows = await this.prisma.ssmEipMovement.findMany({
      where: {
        tenantId,
        movementType: SsmEipMovementType.DISTRIBUTION,
        replacementDueAt: { not: null }
      },
      include: {
        employee: { select: { fullName: true } },
        eipType: { select: { name: true } }
      }
    });
    const now = new Date();
    return {
      reminders: rows
        .map((row) => {
          const daysUntilDue = Math.ceil(
            (row.replacementDueAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            movementId: row.id,
            employeeName: row.employee.fullName,
            eipTypeName: row.eipType.name,
            replacementDueAt: row.replacementDueAt!,
            daysUntilDue
          };
        })
        .filter((item) => [30, 15, 7].includes(item.daysUntilDue) || item.daysUntilDue < 0)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    };
  }

  async stockGapReport(tenantId: string) {
    const [norms, stocks, activeDistributions] = await Promise.all([
      this.prisma.ssmEipNorm.findMany({
        where: { tenantId },
        include: { eipType: { select: { id: true, name: true } } }
      }),
      this.prisma.ssmEipStock.findMany({
        where: { tenantId },
        include: { eipType: { select: { id: true, name: true } } }
      }),
      this.prisma.ssmEipMovement.groupBy({
        by: ["eipTypeId"],
        where: { tenantId, movementType: SsmEipMovementType.DISTRIBUTION },
        _sum: { quantity: true }
      })
    ]);

    const requiredByType = new Map<string, { name: string; required: number }>();
    for (const norm of norms) {
      const current = requiredByType.get(norm.eipTypeId);
      if (!current) {
        requiredByType.set(norm.eipTypeId, { name: norm.eipType.name, required: norm.requiredQuantity });
      } else {
        current.required += norm.requiredQuantity;
      }
    }
    const distributedByType = new Map<string, number>();
    for (const row of activeDistributions) {
      distributedByType.set(row.eipTypeId, row._sum.quantity ?? 0);
    }
    const stockByType = new Map<string, number>();
    for (const stock of stocks) {
      stockByType.set(stock.eipTypeId, stock.quantityOnHand);
      if (!requiredByType.has(stock.eipTypeId)) {
        requiredByType.set(stock.eipTypeId, { name: stock.eipType.name, required: 0 });
      }
    }

    return {
      items: Array.from(requiredByType.entries()).map(([eipTypeId, summary]) => {
        const distributedActive = distributedByType.get(eipTypeId) ?? 0;
        const stockOnHand = stockByType.get(eipTypeId) ?? 0;
        const shortage = Math.max(summary.required - (distributedActive + stockOnHand), 0);
        return {
          eipTypeId,
          eipTypeName: summary.name,
          required: summary.required,
          distributedActive,
          stockOnHand,
          shortage
        };
      })
    };
  }
}
