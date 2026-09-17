import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { extname, resolve } from "path";
import { BadRequestException, Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import {
  SsmDangerousSubstanceHazard,
  SsmDangerousSubstanceStatus,
  SsmDangerousSubstanceUnit
} from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import {
  CreateSsmDangerousSubstanceDto,
  UpdateSsmDangerousSubstanceDto
} from "../../api/dto/ssm-substances.dto";

const SDS_ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const SDS_ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const SDS_MAX_FILE_BYTES = 25 * 1024 * 1024;

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Dată invalidă: ${value}`);
  }
  return d;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class SsmSubstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private assertSdsSheet(file?: Express.Multer.File) {
    if (!file) return;
    if (file.size > SDS_MAX_FILE_BYTES) {
      throw new BadRequestException("Fișa SDS este prea mare. Maxim 25MB.");
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!SDS_ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException("Fișa SDS trebuie să fie PDF sau Word.");
    }
    if (!SDS_ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix) || file.mimetype === prefix)) {
      throw new BadRequestException("Format SDS nesuportat.");
    }
  }

  private async persistSdsSheet(
    tenantId: string,
    substanceId: string,
    file: Express.Multer.File
  ): Promise<{ path: string; name: string; mime: string; size: number }> {
    const safeName = sanitizeFilename(file.originalname);
    const targetDir = resolve(process.cwd(), "uploads", "ssm-substances", tenantId, substanceId);
    await mkdir(targetDir, { recursive: true });
    const absolutePath = resolve(targetDir, `${Date.now()}-${safeName}`);
    await writeFile(absolutePath, file.buffer);
    return { path: absolutePath, name: file.originalname, mime: file.mimetype, size: file.size };
  }

  private mapItem(row: {
    id: string;
    worksiteId: string;
    worksite: { name: string; code: string };
    name: string;
    tradeName: string | null;
    casNumber: string | null;
    unNumber: string | null;
    hazardClass: SsmDangerousSubstanceHazard;
    location: string;
    quantity: number;
    unit: SsmDangerousSubstanceUnit;
    containerType: string | null;
    sdsSheetName: string | null;
    sdsValidUntil: Date | null;
    responsibleName: string | null;
    notes: string | null;
    status: SsmDangerousSubstanceStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      worksiteId: row.worksiteId,
      worksiteName: row.worksite.name,
      worksiteCode: row.worksite.code,
      name: row.name,
      tradeName: row.tradeName,
      casNumber: row.casNumber,
      unNumber: row.unNumber,
      hazardClass: row.hazardClass,
      location: row.location,
      quantity: row.quantity,
      unit: row.unit,
      containerType: row.containerType,
      hasSdsSheet: Boolean(row.sdsSheetName),
      sdsSheetName: row.sdsSheetName,
      sdsValidUntil: row.sdsValidUntil?.toISOString() ?? null,
      responsibleName: row.responsibleName,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async list(tenantId: string, worksiteId?: string) {
    const rows = await this.prisma.ssmDangerousSubstance.findMany({
      where: {
        tenantId,
        ...(worksiteId?.trim() ? { worksiteId: worksiteId.trim() } : {})
      },
      include: { worksite: { select: { name: true, code: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });
    return { items: rows.map((row) => this.mapItem(row)) };
  }

  async create(tenantId: string, actorId: string, dto: CreateSsmDangerousSubstanceDto, sdsSheet?: Express.Multer.File) {
    this.assertSdsSheet(sdsSheet);
    const worksite = await this.prisma.worksite.findFirst({
      where: { id: dto.worksiteId, tenantId }
    });
    if (!worksite) {
      throw new NotFoundException("Punctul de lucru nu a fost găsit.");
    }

    const created = await this.prisma.ssmDangerousSubstance.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId,
        name: dto.name.trim(),
        tradeName: emptyToNull(dto.tradeName) ?? null,
        casNumber: emptyToNull(dto.casNumber) ?? null,
        unNumber: emptyToNull(dto.unNumber) ?? null,
        hazardClass: dto.hazardClass ?? SsmDangerousSubstanceHazard.OTHER,
        location: dto.location.trim(),
        quantity: dto.quantity,
        unit: dto.unit ?? SsmDangerousSubstanceUnit.L,
        containerType: emptyToNull(dto.containerType) ?? null,
        sdsValidUntil: parseOptionalDate(dto.sdsValidUntil) ?? null,
        responsibleName: emptyToNull(dto.responsibleName) ?? null,
        notes: emptyToNull(dto.notes) ?? null,
        createdBy: actorId
      },
      include: { worksite: { select: { name: true, code: true } } }
    });

    let mapped = this.mapItem(created);
    if (sdsSheet) {
      const stored = await this.persistSdsSheet(tenantId, created.id, sdsSheet);
      const updated = await this.prisma.ssmDangerousSubstance.update({
        where: { id: created.id },
        data: {
          sdsSheetPath: stored.path,
          sdsSheetName: stored.name,
          sdsSheetMime: stored.mime,
          sdsSheetSize: stored.size
        },
        include: { worksite: { select: { name: true, code: true } } }
      });
      mapped = this.mapItem(updated);
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DANGEROUS_SUBSTANCE_CREATED",
      entityType: "SsmDangerousSubstance",
      entityId: created.id,
      payload: { name: created.name, worksiteId: created.worksiteId, quantity: created.quantity }
    });

    return mapped;
  }

  async update(
    tenantId: string,
    actorId: string,
    substanceId: string,
    dto: UpdateSsmDangerousSubstanceDto,
    sdsSheet?: Express.Multer.File
  ) {
    this.assertSdsSheet(sdsSheet);
    const existing = await this.prisma.ssmDangerousSubstance.findFirst({
      where: { id: substanceId, tenantId }
    });
    if (!existing) {
      throw new NotFoundException("Substanța nu a fost găsită.");
    }

    const sdsValidUntil = parseOptionalDate(dto.sdsValidUntil);
    let sdsFields:
      | {
          sdsSheetPath: string;
          sdsSheetName: string;
          sdsSheetMime: string;
          sdsSheetSize: number;
        }
      | undefined;
    if (sdsSheet) {
      const stored = await this.persistSdsSheet(tenantId, substanceId, sdsSheet);
      sdsFields = {
        sdsSheetPath: stored.path,
        sdsSheetName: stored.name,
        sdsSheetMime: stored.mime,
        sdsSheetSize: stored.size
      };
    }

    const updated = await this.prisma.ssmDangerousSubstance.update({
      where: { id: substanceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.tradeName !== undefined ? { tradeName: emptyToNull(dto.tradeName) ?? null } : {}),
        ...(dto.casNumber !== undefined ? { casNumber: emptyToNull(dto.casNumber) ?? null } : {}),
        ...(dto.unNumber !== undefined ? { unNumber: emptyToNull(dto.unNumber) ?? null } : {}),
        ...(dto.hazardClass !== undefined ? { hazardClass: dto.hazardClass } : {}),
        ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.containerType !== undefined ? { containerType: emptyToNull(dto.containerType) ?? null } : {}),
        ...(sdsValidUntil !== undefined ? { sdsValidUntil } : {}),
        ...(dto.responsibleName !== undefined ? { responsibleName: emptyToNull(dto.responsibleName) ?? null } : {}),
        ...(dto.notes !== undefined ? { notes: emptyToNull(dto.notes) ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...sdsFields
      },
      include: { worksite: { select: { name: true, code: true } } }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DANGEROUS_SUBSTANCE_UPDATED",
      entityType: "SsmDangerousSubstance",
      entityId: substanceId,
      payload: { quantity: updated.quantity, status: updated.status, location: updated.location }
    });

    return this.mapItem(updated);
  }

  async retire(tenantId: string, actorId: string, substanceId: string) {
    return this.update(tenantId, actorId, substanceId, { status: SsmDangerousSubstanceStatus.RETIRED });
  }

  async downloadSds(tenantId: string, substanceId: string) {
    const row = await this.prisma.ssmDangerousSubstance.findFirst({
      where: { id: substanceId, tenantId }
    });
    if (!row?.sdsSheetPath || !row.sdsSheetName) {
      throw new NotFoundException("Nu există fișă SDS pentru această substanță.");
    }
    return new StreamableFile(createReadStream(row.sdsSheetPath), {
      type: row.sdsSheetMime || "application/pdf",
      disposition: `attachment; filename="${sanitizeFilename(row.sdsSheetName)}"`
    });
  }
}
