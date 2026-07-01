import { createReadStream } from "fs";
import { access, mkdir, writeFile } from "fs/promises";
import { constants } from "fs";
import { extname, resolve } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { SsmDocumentStatus, SsmDocumentTargetType, SsmDocumentType } from "@prisma/client";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { resolveSsmViewerScope } from "../../api/ssm-viewer-scope";
import { CreateSsmDocumentDto } from "../../api/dto/create-ssm-document.dto";
import {
  CreateSsmDocumentTemplateDto,
  UpdateSsmDocumentTemplateDto
} from "../../api/dto/ssm-document-template.dto";
import { resolvePagination } from "../../../../common/dto/pagination-query.dto";
import { paginatedResult } from "../../../../common/pagination";
import { ListSsmDocumentsDto } from "../../api/dto/list-ssm-documents.dto";
import { ItmAccessService } from "./itm-access.service";
import { SystemRole } from "../../../../common/prisma-enums";

const MAX_FILE_BYTES = 120 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".mp4", ".mov", ".avi", ".mkv"]);
const ALLOWED_MIME_PREFIXES = ["application/pdf", "application/msword", "video/", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date value: ${value}`);
  }
  return d;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toBool(value?: string): boolean {
  return value === "true" || value === "1" || value === "yes";
}

type EmployeePlacementNames = {
  department: { name: string } | null;
  jobPosition: { name: string } | null;
  worksite: { name: string } | null;
};

function ssmDocumentVisibleToEmployee(
  doc: { targetType: SsmDocumentTargetType; targetLabel: string | null; status: SsmDocumentStatus },
  employee: EmployeePlacementNames
): boolean {
  if (doc.status !== SsmDocumentStatus.ACTIVE) {
    return false;
  }
  if (doc.targetType === SsmDocumentTargetType.ALL) {
    return true;
  }
  if (doc.targetType === SsmDocumentTargetType.DEPARTMENT) {
    return doc.targetLabel === (employee.department?.name ?? undefined);
  }
  if (doc.targetType === SsmDocumentTargetType.JOB_POSITION) {
    return doc.targetLabel === (employee.jobPosition?.name ?? undefined);
  }
  if (doc.targetType === SsmDocumentTargetType.WORKSITE) {
    return doc.targetLabel === (employee.worksite?.name ?? undefined);
  }
  return false;
}

@Injectable()
export class SsmDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly itmAccess: ItmAccessService
  ) {}

  private assertUpload(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Document file is required.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException("File too large. Max 120MB.");
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException("Only Word, PDF, or video uploads are allowed.");
    }
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix))) {
      throw new BadRequestException("Unsupported file format.");
    }
  }

  private async persistFile(
    tenantId: string,
    documentId: string,
    versionNumber: number,
    file: Express.Multer.File
  ): Promise<string> {
    const safeName = sanitizeFilename(file.originalname);
    const fileName = `v${versionNumber}-${Date.now()}-${safeName}`;
    const targetDir = resolve(process.cwd(), "uploads", "ssm-documents", tenantId, documentId);
    await mkdir(targetDir, { recursive: true });
    const absolutePath = resolve(targetDir, fileName);
    await writeFile(absolutePath, file.buffer);
    return absolutePath;
  }

  async createDocument(
    tenantId: string,
    actorId: string,
    dto: CreateSsmDocumentDto,
    file?: Express.Multer.File
  ) {
    this.assertUpload(file);
    const upload = file as Express.Multer.File;

    const periodStart = parseOptionalDate(dto.periodStart);
    const periodEnd = parseOptionalDate(dto.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException("periodStart must be before periodEnd.");
    }

    return this.prisma.$transaction(async (tx) => {
      const createdDoc = await tx.ssmDocument.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          type: dto.type,
          entityName: dto.entityName?.trim(),
          departmentName: dto.departmentName?.trim(),
          jobPositionName: dto.jobPositionName?.trim(),
          periodStart,
          periodEnd,
          targetType: dto.targetType,
          targetRefId: dto.targetRefId?.trim(),
          targetLabel: dto.targetLabel?.trim(),
          isControlFolder: dto.isControlFolder ?? false,
          createdBy: actorId
        }
      });

      const storagePath = await this.persistFile(tenantId, createdDoc.id, 1, upload);
      const version = await tx.ssmDocumentVersion.create({
        data: {
          tenantId,
          documentId: createdDoc.id,
          versionNumber: 1,
          fileName: upload.originalname,
          mimeType: upload.mimetype,
          fileSize: upload.size,
          storagePath,
          changeNote: dto.changeNote?.trim(),
          createdBy: actorId
        }
      });

      await tx.ssmDocument.update({
        where: { id: createdDoc.id },
        data: { activeVersionId: version.id }
      });

      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SSM",
        action: "DOCUMENT_CREATED",
        entityType: "SsmDocument",
        entityId: createdDoc.id,
        payload: { type: dto.type, title: dto.title.trim(), version: 1 }
      });

      return { documentId: createdDoc.id, versionId: version.id, versionNumber: 1 };
    });
  }

  async addVersion(
    tenantId: string,
    actorId: string,
    documentId: string,
    changeNote: string | undefined,
    file?: Express.Multer.File
  ) {
    this.assertUpload(file);
    const upload = file as Express.Multer.File;
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId }
    });
    if (!document) {
      throw new NotFoundException("Document not found.");
    }
    if (document.status === SsmDocumentStatus.ARCHIVED) {
      throw new BadRequestException("Cannot upload a new version for archived document.");
    }

    const lastVersion = await this.prisma.ssmDocumentVersion.findFirst({
      where: { tenantId, documentId },
      orderBy: { versionNumber: "desc" }
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;
    const storagePath = await this.persistFile(tenantId, documentId, nextVersion, upload);
    const version = await this.prisma.ssmDocumentVersion.create({
      data: {
        tenantId,
        documentId,
        versionNumber: nextVersion,
        fileName: upload.originalname,
        mimeType: upload.mimetype,
        fileSize: upload.size,
        storagePath,
        changeNote: changeNote?.trim(),
        createdBy: actorId
      }
    });
    await this.prisma.ssmDocument.update({
      where: { id: documentId },
      data: { activeVersionId: version.id }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_VERSION_ADDED",
      entityType: "SsmDocument",
      entityId: documentId,
      payload: { version: nextVersion }
    });

    return { documentId, versionId: version.id, versionNumber: nextVersion };
  }

  async revertToVersion(tenantId: string, actorId: string, documentId: string, versionId: string, note?: string) {
    const version = await this.prisma.ssmDocumentVersion.findFirst({
      where: { id: versionId, tenantId, documentId }
    });
    if (!version) {
      throw new NotFoundException("Version not found for this document.");
    }

    await this.prisma.ssmDocument.update({
      where: { id: documentId },
      data: {
        activeVersionId: version.id,
        status: SsmDocumentStatus.ACTIVE
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_REVERTED",
      entityType: "SsmDocument",
      entityId: documentId,
      payload: { toVersion: version.versionNumber, note: note?.trim() }
    });

    return { documentId, activeVersionId: version.id, activeVersionNumber: version.versionNumber };
  }

  async archiveDocument(tenantId: string, actorId: string, documentId: string) {
    const updated = await this.prisma.ssmDocument.updateMany({
      where: { id: documentId, tenantId, status: SsmDocumentStatus.ACTIVE },
      data: { status: SsmDocumentStatus.ARCHIVED }
    });
    if (!updated.count) {
      throw new NotFoundException("Active document not found.");
    }

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_ARCHIVED",
      entityType: "SsmDocument",
      entityId: documentId
    });

    return { documentId, status: SsmDocumentStatus.ARCHIVED };
  }

  private async employeeRowForViewer(
    tenantId: string,
    viewer: JwtPayload
  ): Promise<
    | { scope: "tenant" }
    | { scope: "empty" }
    | { scope: "self"; employee: EmployeePlacementNames }
    | { scope: "worksite"; worksiteName: string | null; worksiteIds: string[] }
  > {
    const resolved = await resolveSsmViewerScope(this.prisma, tenantId, viewer);
    if (resolved.mode === "tenant") {
      return { scope: "tenant" };
    }
    if (resolved.mode === "empty") {
      return { scope: "empty" };
    }
    if (resolved.mode === "worksite" || resolved.mode === "worksites") {
      const worksiteIds =
        resolved.mode === "worksite" ? [resolved.worksiteId] : resolved.worksiteIds;
      const ws = await this.prisma.worksite.findFirst({
        where: { id: worksiteIds[0], tenantId },
        select: { name: true }
      });
      return { scope: "worksite", worksiteName: ws?.name ?? null, worksiteIds };
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: resolved.employeeId, tenantId },
      include: {
        department: { select: { name: true } },
        jobPosition: { select: { name: true } },
        worksite: { select: { name: true } }
      }
    });
    if (!employee) {
      return { scope: "empty" };
    }
    return {
      scope: "self",
      employee: {
        department: employee.department,
        jobPosition: employee.jobPosition,
        worksite: employee.worksite
      }
    };
  }

  async listDocuments(tenantId: string, query: ListSsmDocumentsDto, viewer: JwtPayload) {
    const ctx = await this.employeeRowForViewer(tenantId, viewer);
    if (ctx.scope === "empty") {
      return paginatedResult([], 0, 1, resolvePagination(query).pageSize);
    }
    const p = resolvePagination(query);
    const dbWhere = {
      tenantId,
      activeVersionId: { not: null },
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.entityName ? { entityName: { contains: query.entityName, mode: "insensitive" as const } } : {}),
      ...(query.departmentName
        ? { departmentName: { contains: query.departmentName, mode: "insensitive" as const } }
        : {}),
      ...(query.jobPositionName
        ? { jobPositionName: { contains: query.jobPositionName, mode: "insensitive" as const } }
        : {}),
      ...(query.controlOnly && toBool(query.controlOnly) ? { isControlFolder: true } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { targetLabel: { contains: query.q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    if (ctx.scope === "self") {
      const rows = await this.prisma.ssmDocument.findMany({
        where: dbWhere,
        include: { activeVersion: true },
        orderBy: [{ updatedAt: "desc" }]
      });
      const filtered = rows
        .filter((row) => row.activeVersion)
        .filter((row) =>
          ssmDocumentVisibleToEmployee(
            { targetType: row.targetType, targetLabel: row.targetLabel, status: row.status },
            ctx.employee
          )
        );
      const total = filtered.length;
      const pageItems = filtered.slice(p.skip, p.skip + p.take);
      return paginatedResult(
        pageItems.map((row) => ({ ...row, activeVersion: row.activeVersion! })),
        total,
        p.page,
        p.pageSize
      );
    }

    if (ctx.scope === "worksite") {
      const [departments, jobPositions, rows] = await Promise.all([
        this.prisma.department.findMany({
          where: { tenantId, worksiteId: { in: ctx.worksiteIds } },
          select: { name: true }
        }),
        this.prisma.jobPosition.findMany({
          where: {
            tenantId,
            department: { worksiteId: { in: ctx.worksiteIds } }
          },
          select: { name: true }
        }),
        this.prisma.ssmDocument.findMany({
          where: dbWhere,
          include: { activeVersion: true },
          orderBy: [{ updatedAt: "desc" }]
        })
      ]);
      const depNames = new Set(departments.map((d) => d.name));
      const jobNames = new Set(jobPositions.map((j) => j.name));
      const filtered = rows
        .filter((row) => row.activeVersion)
        .filter((row) => {
          if (row.status !== SsmDocumentStatus.ACTIVE) return false;
          if (row.targetType === SsmDocumentTargetType.ALL) return true;
          if (row.targetType === SsmDocumentTargetType.WORKSITE) {
            return row.targetLabel === ctx.worksiteName;
          }
          if (row.targetType === SsmDocumentTargetType.DEPARTMENT) {
            return row.targetLabel ? depNames.has(row.targetLabel) : false;
          }
          if (row.targetType === SsmDocumentTargetType.JOB_POSITION) {
            return row.targetLabel ? jobNames.has(row.targetLabel) : false;
          }
          return false;
        });
      const total = filtered.length;
      const pageItems = filtered.slice(p.skip, p.skip + p.take);
      return paginatedResult(
        pageItems.map((row) => ({ ...row, activeVersion: row.activeVersion! })),
        total,
        p.page,
        p.pageSize
      );
    }

    const [rows, total] = await Promise.all([
      this.prisma.ssmDocument.findMany({
        where: dbWhere,
        include: { activeVersion: true },
        orderBy: [{ updatedAt: "desc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.ssmDocument.count({ where: dbWhere })
    ]);
    return paginatedResult(
      rows
        .filter((row) => row.activeVersion)
        .map((row) => ({ ...row, activeVersion: row.activeVersion! })),
      total,
      p.page,
      p.pageSize
    );
  }

  private async assertDocumentReadable(tenantId: string, documentId: string, viewer: JwtPayload) {
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId },
      include: { activeVersion: true }
    });
    if (!document?.activeVersion?.storagePath) {
      throw new NotFoundException("Document not found.");
    }

    const ctx = await this.employeeRowForViewer(tenantId, viewer);
    if (ctx.scope === "empty") {
      throw new ForbiddenException("Contul nu este asociat unui angajat pentru acces la documente.");
    }
    if (
      ctx.scope === "self" &&
      !ssmDocumentVisibleToEmployee(
        {
          targetType: document.targetType,
          targetLabel: document.targetLabel,
          status: document.status
        },
        ctx.employee
      )
    ) {
      throw new ForbiddenException("Nu aveți acces la acest document.");
    }

    try {
      await access(document.activeVersion.storagePath, constants.R_OK);
    } catch {
      throw new NotFoundException("Fișierul documentului nu a fost găsit pe server.");
    }

    return document;
  }

  async streamActiveVersion(tenantId: string, documentId: string, viewer: JwtPayload) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const document = await this.assertDocumentReadable(tenantId, documentId, viewer);
    const version = document.activeVersion!;
    if (viewer.roles?.includes(SystemRole.ITM_INSPECTOR)) {
      await this.itmAccess.logAccess(tenantId, viewer.sub, "DOWNLOAD", "SsmDocument", documentId, {
        title: document.title,
        fileName: version.fileName
      });
    }
    return {
      stream: createReadStream(version.storagePath),
      mimeType: version.mimeType,
      fileName: version.fileName
    };
  }

  async getDocumentHistory(tenantId: string, documentId: string, viewer: JwtPayload) {
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
        }
      }
    });
    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    const ctx = await this.employeeRowForViewer(tenantId, viewer);
    if (ctx.scope === "empty") {
      throw new ForbiddenException("Contul nu este asociat unui angajat pentru acces la documente.");
    }
    if (
      ctx.scope === "self" &&
      !ssmDocumentVisibleToEmployee(
        {
          targetType: document.targetType,
          targetLabel: document.targetLabel,
          status: document.status
        },
        ctx.employee
      )
    ) {
      throw new ForbiddenException("Nu aveți acces la acest document.");
    }
    return {
      documentId: document.id,
      title: document.title,
      activeVersionId: document.activeVersionId,
      versions: document.versions
    };
  }

  async quickControlAccess(tenantId: string, viewer: JwtPayload) {
    const ctx = await this.employeeRowForViewer(tenantId, viewer);
    if (ctx.scope === "empty") {
      return { folders: [] };
    }
    const rows = await this.prisma.ssmDocument.findMany({
      where: {
        tenantId,
        isControlFolder: true,
        status: SsmDocumentStatus.ACTIVE
      },
      include: {
        activeVersion: true
      },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }]
    });

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      if (ctx.scope === "self" && !ssmDocumentVisibleToEmployee(row, ctx.employee)) {
        continue;
      }
      const key = `${row.type}/${row.targetType}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }

    return {
      folders: Array.from(grouped.entries()).map(([key, docs]) => ({
        key,
        label: key.replace("_", " "),
        count: docs.length,
        documents: docs.filter((doc) => doc.activeVersion)
      }))
    };
  }

  static documentTypes(): SsmDocumentType[] {
    return Object.values(SsmDocumentType);
  }

  static documentTargets(): SsmDocumentTargetType[] {
    return Object.values(SsmDocumentTargetType);
  }

  async listTemplates(tenantId: string, activeOnly = true) {
    const rows = await this.prisma.ssmDocumentTemplate.findMany({
      where: { tenantId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        type: row.type,
        targetType: row.targetType,
        targetLabel: row.targetLabel,
        isControlFolder: row.isControlFolder,
        checklistItems: row.checklistItems,
        active: row.active,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }))
    };
  }

  async createTemplate(tenantId: string, actorId: string, dto: CreateSsmDocumentTemplateDto) {
    const row = await this.prisma.ssmDocumentTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        title: dto.title.trim(),
        type: dto.type,
        targetType: dto.targetType ?? SsmDocumentTargetType.ENTITY,
        targetLabel: dto.targetLabel?.trim(),
        isControlFolder: dto.isControlFolder ?? false,
        checklistItems: dto.checklistItems ?? [],
        active: dto.active ?? true,
        createdBy: actorId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_TEMPLATE_CREATED",
      entityType: "SsmDocumentTemplate",
      entityId: row.id,
      payload: { type: row.type, name: row.name }
    });
    return { id: row.id };
  }

  async updateTemplate(tenantId: string, actorId: string, id: string, dto: UpdateSsmDocumentTemplateDto) {
    const existing = await this.prisma.ssmDocumentTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Șablonul de document nu a fost găsit.");
    }
    await this.prisma.ssmDocumentTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        title: dto.title?.trim(),
        type: dto.type,
        targetType: dto.targetType,
        targetLabel: dto.targetLabel === undefined ? undefined : dto.targetLabel?.trim() ?? null,
        isControlFolder: dto.isControlFolder,
        checklistItems: dto.checklistItems,
        active: dto.active
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_TEMPLATE_UPDATED",
      entityType: "SsmDocumentTemplate",
      entityId: id,
      payload: {}
    });
    return { id };
  }

  async seedDefaultTemplates(tenantId: string, actorId: string) {
    const defaults: CreateSsmDocumentTemplateDto[] = [
      {
        name: "ipssm-entitate",
        title: "Instrucțiuni proprii SSM — {entitate}",
        type: SsmDocumentType.IPSSM,
        targetType: SsmDocumentTargetType.ENTITY,
        isControlFolder: true,
        checklistItems: ["Semnat de conducere", "Comunicat angajaților", "Revizie la 12 luni"]
      },
      {
        name: "ppp-post",
        title: "Program prevenire și protecție — {post}",
        type: SsmDocumentType.PPP,
        targetType: SsmDocumentTargetType.JOB_POSITION,
        isControlFolder: true,
        checklistItems: ["Măsuri tehnice", "Măsuri organizatorice", "EIP aferent"]
      },
      {
        name: "registru-accidente",
        title: "Registru accidente de muncă",
        type: SsmDocumentType.REGISTER,
        targetType: SsmDocumentTargetType.ENTITY,
        isControlFolder: true,
        checklistItems: ["Numerotare continuă", "Păstrare 45 zile la punct de lucru"]
      },
      {
        name: "psi-evacuare",
        title: "Documentație PSI / plan evacuare",
        type: SsmDocumentType.PSI,
        targetType: SsmDocumentTargetType.WORKSITE,
        isControlFolder: true,
        checklistItems: ["Plan evacuare", "Verificare stingătoare", "Instruire SU"]
      }
    ];
    let created = 0;
    for (const item of defaults) {
      const exists = await this.prisma.ssmDocumentTemplate.findFirst({
        where: { tenantId, name: item.name }
      });
      if (exists) continue;
      await this.createTemplate(tenantId, actorId, item);
      created += 1;
    }
    return { created };
  }
}
