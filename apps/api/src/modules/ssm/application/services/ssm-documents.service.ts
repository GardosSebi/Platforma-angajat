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
import { SsmTrainingAutomationService } from "./ssm-training-automation.service";
import {
  assertDocumentTypeAccess,
  canAccessDocumentType,
  defaultPoliciesForSeed,
  DOCUMENT_TYPE_MODULE_HINTS,
  type DocumentTypePolicyRow
} from "../document-type-acl";

const MAX_FILE_BYTES = 120 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".mp4", ".mov", ".avi", ".mkv"]);
const ALLOWED_MIME_PREFIXES = ["application/pdf", "application/msword", "video/", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const PROCEDURE_DOCUMENT_TYPES = new Set<SsmDocumentType>([
  SsmDocumentType.IPSSM,
  SsmDocumentType.EMERGENCY_PROCEDURE,
  SsmDocumentType.PSI,
  SsmDocumentType.THEMATIC,
  SsmDocumentType.PPP
]);

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
  worksite: { name: string; legalEntity: { name: string } | null } | null;
  entityName?: string | null;
};

function ssmDocumentVisibleToEmployee(
  doc: {
    targetType: SsmDocumentTargetType;
    targetLabel: string | null;
    entityName?: string | null;
    status: SsmDocumentStatus;
  },
  employee: EmployeePlacementNames
): boolean {
  if (doc.status !== SsmDocumentStatus.APPROVED) {
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
  if (doc.targetType === SsmDocumentTargetType.ENTITY) {
    const employeeEntity =
      employee.worksite?.legalEntity?.name ?? employee.entityName ?? null;
    if (!doc.targetLabel && !doc.entityName) {
      return true;
    }
    const needle = (doc.targetLabel ?? doc.entityName ?? "").trim().toLowerCase();
    if (!needle) return true;
    return Boolean(employeeEntity && employeeEntity.trim().toLowerCase() === needle);
  }
  return false;
}

@Injectable()
export class SsmDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly itmAccess: ItmAccessService,
    private readonly trainingAutomation: SsmTrainingAutomationService
  ) {}

  private async resolveProcedureAudienceEmployeeIds(
    tenantId: string,
    doc: {
      targetType: SsmDocumentTargetType;
      targetRefId: string | null;
      targetLabel: string | null;
    }
  ): Promise<string[]> {
    const base = { tenantId, active: true as const };
    if (doc.targetType === SsmDocumentTargetType.ALL || doc.targetType === SsmDocumentTargetType.ENTITY) {
      const rows = await this.prisma.employee.findMany({ where: base, select: { id: true } });
      return rows.map((r) => r.id);
    }
    if (doc.targetType === SsmDocumentTargetType.DEPARTMENT) {
      const rows = await this.prisma.employee.findMany({
        where: {
          ...base,
          ...(doc.targetRefId
            ? { departmentId: doc.targetRefId }
            : doc.targetLabel
              ? { department: { name: doc.targetLabel } }
              : { id: "__none__" })
        },
        select: { id: true }
      });
      return rows.map((r) => r.id);
    }
    if (doc.targetType === SsmDocumentTargetType.JOB_POSITION) {
      const rows = await this.prisma.employee.findMany({
        where: {
          ...base,
          ...(doc.targetRefId
            ? { jobPositionId: doc.targetRefId }
            : doc.targetLabel
              ? { jobPosition: { name: doc.targetLabel } }
              : { id: "__none__" })
        },
        select: { id: true }
      });
      return rows.map((r) => r.id);
    }
    if (doc.targetType === SsmDocumentTargetType.WORKSITE) {
      const rows = await this.prisma.employee.findMany({
        where: {
          ...base,
          ...(doc.targetRefId
            ? { worksiteId: doc.targetRefId }
            : doc.targetLabel
              ? { worksite: { name: doc.targetLabel } }
              : { id: "__none__" })
        },
        select: { id: true }
      });
      return rows.map((r) => r.id);
    }
    return [];
  }

  private async triggerProcedureTrainingIfNeeded(
    tenantId: string,
    actorId: string,
    doc: {
      type: SsmDocumentType;
      title: string;
      targetType: SsmDocumentTargetType;
      targetRefId: string | null;
      targetLabel: string | null;
    }
  ) {
    if (!PROCEDURE_DOCUMENT_TYPES.has(doc.type)) {
      return;
    }
    const employeeIds = await this.resolveProcedureAudienceEmployeeIds(tenantId, doc);
    if (!employeeIds.length) {
      return;
    }
    await this.trainingAutomation.assignOnProcedureChange(tenantId, actorId, employeeIds, doc.title);
  }

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
    file?: Express.Multer.File,
    viewer?: JwtPayload
  ) {
    this.assertUpload(file);
    const upload = file as Express.Multer.File;
    if (viewer) {
      const policies = await this.loadTypePolicies(tenantId);
      assertDocumentTypeAccess(viewer, dto.type, "edit", policies);
    }

    const periodStart = parseOptionalDate(dto.periodStart);
    const periodEnd = parseOptionalDate(dto.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException("periodStart must be before periodEnd.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
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

      return {
        documentId: createdDoc.id,
        versionId: version.id,
        versionNumber: 1,
        type: createdDoc.type,
        title: createdDoc.title,
        targetType: createdDoc.targetType,
        targetRefId: createdDoc.targetRefId,
        targetLabel: createdDoc.targetLabel
      };
    });

    await this.triggerProcedureTrainingIfNeeded(tenantId, actorId, {
      type: result.type,
      title: result.title,
      targetType: result.targetType,
      targetRefId: result.targetRefId,
      targetLabel: result.targetLabel
    });

    return {
      documentId: result.documentId,
      versionId: result.versionId,
      versionNumber: result.versionNumber
    };
  }

  async addVersion(
    tenantId: string,
    actorId: string,
    documentId: string,
    changeNote: string | undefined,
    file?: Express.Multer.File,
    viewer?: JwtPayload
  ) {
    this.assertUpload(file);
    const upload = file as Express.Multer.File;
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId }
    });
    if (!document) {
      throw new NotFoundException("Document not found.");
    }
    if (viewer) {
      const policies = await this.loadTypePolicies(tenantId);
      assertDocumentTypeAccess(viewer, document.type, "edit", policies);
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
      data: {
        activeVersionId: version.id,
        status: SsmDocumentStatus.ACTIVE,
        approvedBy: null,
        approvedAt: null
      }
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

    await this.triggerProcedureTrainingIfNeeded(tenantId, actorId, {
      type: document.type,
      title: document.title,
      targetType: document.targetType,
      targetRefId: document.targetRefId,
      targetLabel: document.targetLabel
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
        status: SsmDocumentStatus.ACTIVE,
        approvedBy: null,
        approvedAt: null
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

  async approveDocument(tenantId: string, actorId: string, documentId: string, viewer: JwtPayload) {
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId }
    });
    if (!document) {
      throw new NotFoundException("Document not found.");
    }
    if (document.status === SsmDocumentStatus.ARCHIVED) {
      throw new BadRequestException("Cannot approve an archived document.");
    }
    if (document.status === SsmDocumentStatus.APPROVED) {
      return {
        documentId,
        status: SsmDocumentStatus.APPROVED,
        approvedBy: document.approvedBy,
        approvedAt: document.approvedAt?.toISOString() ?? null
      };
    }

    const policies = await this.loadTypePolicies(tenantId);
    assertDocumentTypeAccess(viewer, document.type, "approve", policies);

    const approvedAt = new Date();
    await this.prisma.ssmDocument.update({
      where: { id: documentId },
      data: {
        status: SsmDocumentStatus.APPROVED,
        approvedBy: actorId,
        approvedAt
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_APPROVED",
      entityType: "SsmDocument",
      entityId: documentId,
      payload: { type: document.type, title: document.title }
    });

    return {
      documentId,
      status: SsmDocumentStatus.APPROVED,
      approvedBy: actorId,
      approvedAt: approvedAt.toISOString()
    };
  }

  async archiveDocument(tenantId: string, actorId: string, documentId: string) {
    const updated = await this.prisma.ssmDocument.updateMany({
      where: {
        id: documentId,
        tenantId,
        status: { in: [SsmDocumentStatus.ACTIVE, SsmDocumentStatus.APPROVED] }
      },
      data: {
        status: SsmDocumentStatus.ARCHIVED,
        approvedBy: null,
        approvedAt: null
      }
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
        worksite: { select: { name: true, legalEntity: { select: { name: true } } } }
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
        worksite: employee.worksite,
        entityName: employee.worksite?.legalEntity?.name ?? null
      }
    };
  }

  private async loadTypePolicies(tenantId: string): Promise<DocumentTypePolicyRow[]> {
    const rows = await this.prisma.ssmDocumentTypePolicy.findMany({ where: { tenantId } });
    return rows.map((row) => ({
      documentType: row.documentType,
      viewRoles: row.viewRoles,
      editRoles: row.editRoles,
      approveRoles: row.approveRoles,
      relatedModuleHint: row.relatedModuleHint
    }));
  }

  private allowedTypesForViewer(
    viewer: JwtPayload,
    action: "view" | "edit" | "approve",
    policies: DocumentTypePolicyRow[]
  ): SsmDocumentType[] | null {
    const allTypes = Object.values(SsmDocumentType);
    const allowed = allTypes.filter((type) => canAccessDocumentType(viewer, type, action, policies));
    if (allowed.length === allTypes.length) return null;
    return allowed;
  }

  async listDocuments(tenantId: string, query: ListSsmDocumentsDto, viewer: JwtPayload) {
    const ctx = await this.employeeRowForViewer(tenantId, viewer);
    if (ctx.scope === "empty") {
      return paginatedResult([], 0, 1, resolvePagination(query).pageSize);
    }
    const policies = await this.loadTypePolicies(tenantId);
    const allowedTypes = this.allowedTypesForViewer(viewer, "view", policies);
    if (allowedTypes && allowedTypes.length === 0) {
      return paginatedResult([], 0, 1, resolvePagination(query).pageSize);
    }
    if (query.type && allowedTypes && !allowedTypes.includes(query.type)) {
      return paginatedResult([], 0, 1, resolvePagination(query).pageSize);
    }

    const periodFrom = parseOptionalDate(query.periodFrom);
    const periodTo = parseOptionalDate(query.periodTo);
    const p = resolvePagination(query);
    const dbWhere = {
      tenantId,
      activeVersionId: { not: null },
      ...(query.type ? { type: query.type } : allowedTypes ? { type: { in: allowedTypes } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.entityName ? { entityName: { contains: query.entityName, mode: "insensitive" as const } } : {}),
      ...(query.departmentName
        ? { departmentName: { contains: query.departmentName, mode: "insensitive" as const } }
        : {}),
      ...(query.jobPositionName
        ? { jobPositionName: { contains: query.jobPositionName, mode: "insensitive" as const } }
        : {}),
      ...(periodFrom || periodTo
        ? {
            AND: [
              ...(periodFrom
                ? [
                    {
                      OR: [{ periodEnd: null }, { periodEnd: { gte: periodFrom } }]
                    }
                  ]
                : []),
              ...(periodTo
                ? [
                    {
                      OR: [{ periodStart: null }, { periodStart: { lte: periodTo } }]
                    }
                  ]
                : [])
            ]
          }
        : {}),
      ...(query.controlOnly && toBool(query.controlOnly) ? { isControlFolder: true } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { targetLabel: { contains: query.q, mode: "insensitive" as const } },
              { entityName: { contains: query.q, mode: "insensitive" as const } },
              { departmentName: { contains: query.q, mode: "insensitive" as const } },
              { jobPositionName: { contains: query.q, mode: "insensitive" as const } }
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
            {
              targetType: row.targetType,
              targetLabel: row.targetLabel,
              entityName: row.entityName,
              status: row.status
            },
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
          if (row.status !== SsmDocumentStatus.APPROVED) return false;
          if (row.targetType === SsmDocumentTargetType.ALL) return true;
          if (row.targetType === SsmDocumentTargetType.ENTITY) return true;
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
          entityName: document.entityName,
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
    const policies = await this.loadTypePolicies(tenantId);
    assertDocumentTypeAccess(viewer, document.type, "view", policies);
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

  async streamDocumentVersion(
    tenantId: string,
    documentId: string,
    versionId: string,
    viewer: JwtPayload
  ) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const document = await this.prisma.ssmDocument.findFirst({
      where: { id: documentId, tenantId }
    });
    if (!document) {
      throw new NotFoundException("Document not found.");
    }
    const policies = await this.loadTypePolicies(tenantId);
    assertDocumentTypeAccess(viewer, document.type, "view", policies);

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
          entityName: document.entityName,
          status: SsmDocumentStatus.APPROVED
        },
        ctx.employee
      )
    ) {
      throw new ForbiddenException("Nu aveți acces la acest document.");
    }

    const version = await this.prisma.ssmDocumentVersion.findFirst({
      where: { id: versionId, tenantId, documentId }
    });
    if (!version) {
      throw new NotFoundException("Version not found.");
    }
    try {
      await access(version.storagePath, constants.R_OK);
    } catch {
      throw new NotFoundException("Fișierul versiunii nu a fost găsit pe server.");
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

    const policies = await this.loadTypePolicies(tenantId);
    assertDocumentTypeAccess(viewer, document.type, "view", policies);

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
          entityName: document.entityName,
          status: document.status === SsmDocumentStatus.ARCHIVED ? SsmDocumentStatus.APPROVED : document.status
        },
        ctx.employee
      )
    ) {
      throw new ForbiddenException("Nu aveți acces la acest document.");
    }

    const authorIds = [...new Set(document.versions.map((v) => v.createdBy))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds }, tenantId },
      select: { id: true, fullName: true, email: true }
    });
    const authorMap = new Map(authors.map((a) => [a.id, a.fullName || a.email]));

    return {
      documentId: document.id,
      title: document.title,
      type: document.type,
      relatedModuleHint: DOCUMENT_TYPE_MODULE_HINTS[document.type] ?? null,
      activeVersionId: document.activeVersionId,
      versions: document.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
        mimeType: version.mimeType,
        fileSize: version.fileSize,
        createdBy: version.createdBy,
        createdByName: authorMap.get(version.createdBy) ?? version.createdBy,
        createdAt: version.createdAt.toISOString(),
        changeNote: version.changeNote,
        isActive: version.id === document.activeVersionId
      }))
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
        status: SsmDocumentStatus.APPROVED
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
        hasFile: Boolean(row.storagePath),
        fileName: row.fileName,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        relatedModuleHint: DOCUMENT_TYPE_MODULE_HINTS[row.type] ?? null,
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
      },
      {
        name: "fisa-expunere-riscuri",
        title: "Fișă expunere la riscuri profesionale",
        type: SsmDocumentType.EXPOSURE_SHEET,
        targetType: SsmDocumentTargetType.JOB_POSITION,
        isControlFolder: true,
        checklistItems: ["La angajare", "Semnată de angajat", "Arhivată în dosar"]
      },
      {
        name: "conventie-ssm",
        title: "Convenție SSM — activități cu mai mulți angajatori",
        type: SsmDocumentType.SSM_CONVENTION,
        targetType: SsmDocumentTargetType.WORKSITE,
        checklistItems: ["Părți semnatare", "Responsabilități", "Durată convenție"]
      },
      {
        name: "lista-substante-periculoase",
        title: "Listă substanțe periculoase",
        type: SsmDocumentType.DANGEROUS_SUBSTANCES,
        targetType: SsmDocumentTargetType.WORKSITE,
        checklistItems: ["Denumire substanță", "Clasificare", "Măsuri manipulare"]
      },
      {
        name: "procedura-urgenta",
        title: "Procedură situații de urgență",
        type: SsmDocumentType.EMERGENCY_PROCEDURE,
        targetType: SsmDocumentTargetType.WORKSITE,
        checklistItems: ["Tip urgență", "Pași intervenție", "Contacte"]
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
    await this.seedDefaultTypePolicies(tenantId);
    return { created };
  }

  async uploadTemplateFile(
    tenantId: string,
    actorId: string,
    templateId: string,
    file?: Express.Multer.File
  ) {
    this.assertUpload(file);
    const upload = file as Express.Multer.File;
    const template = await this.prisma.ssmDocumentTemplate.findFirst({
      where: { id: templateId, tenantId }
    });
    if (!template) {
      throw new NotFoundException("Șablonul de document nu a fost găsit.");
    }
    const safeName = sanitizeFilename(upload.originalname);
    const fileName = `template-${Date.now()}-${safeName}`;
    const targetDir = resolve(process.cwd(), "uploads", "ssm-document-templates", tenantId, templateId);
    await mkdir(targetDir, { recursive: true });
    const absolutePath = resolve(targetDir, fileName);
    await writeFile(absolutePath, upload.buffer);

    await this.prisma.ssmDocumentTemplate.update({
      where: { id: templateId },
      data: {
        fileName: upload.originalname,
        mimeType: upload.mimetype,
        fileSize: upload.size,
        storagePath: absolutePath
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_TEMPLATE_FILE_UPLOADED",
      entityType: "SsmDocumentTemplate",
      entityId: templateId,
      payload: { fileName: upload.originalname }
    });
    return {
      templateId,
      fileName: upload.originalname,
      mimeType: upload.mimetype,
      hasFile: true
    };
  }

  async streamTemplateFile(tenantId: string, templateId: string) {
    const template = await this.prisma.ssmDocumentTemplate.findFirst({
      where: { id: templateId, tenantId }
    });
    if (!template?.storagePath) {
      throw new NotFoundException("Șablonul nu are fișier atașat.");
    }
    try {
      await access(template.storagePath, constants.R_OK);
    } catch {
      throw new NotFoundException("Fișierul șablonului nu a fost găsit pe server.");
    }
    return {
      stream: createReadStream(template.storagePath),
      mimeType: template.mimeType ?? "application/octet-stream",
      fileName: template.fileName ?? "template"
    };
  }

  async createDocumentFromTemplate(
    tenantId: string,
    actorId: string,
    templateId: string,
    viewer: JwtPayload,
    overrides?: { title?: string; targetLabel?: string }
  ) {
    const template = await this.prisma.ssmDocumentTemplate.findFirst({
      where: { id: templateId, tenantId, active: true }
    });
    if (!template) {
      throw new NotFoundException("Șablonul de document nu a fost găsit.");
    }
    if (!template.storagePath || !template.fileName || !template.mimeType) {
      throw new BadRequestException("Șablonul nu are fișier. Încărcați mai întâi un Word/PDF.");
    }
    try {
      await access(template.storagePath, constants.R_OK);
    } catch {
      throw new NotFoundException("Fișierul șablonului nu a fost găsit pe server.");
    }
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(template.storagePath);
    const fakeFile = {
      originalname: template.fileName,
      mimetype: template.mimeType,
      size: template.fileSize ?? buffer.length,
      buffer
    } as Express.Multer.File;

    return this.createDocument(
      tenantId,
      actorId,
      {
        title: overrides?.title?.trim() || template.title,
        type: template.type,
        targetType: template.targetType,
        targetLabel: overrides?.targetLabel?.trim() || template.targetLabel || undefined,
        isControlFolder: template.isControlFolder,
        changeNote: `Creat din șablon ${template.name}`
      },
      fakeFile,
      viewer
    );
  }

  async listTypePolicies(tenantId: string) {
    let rows = await this.prisma.ssmDocumentTypePolicy.findMany({
      where: { tenantId },
      orderBy: { documentType: "asc" }
    });
    if (!rows.length) {
      await this.seedDefaultTypePolicies(tenantId);
      rows = await this.prisma.ssmDocumentTypePolicy.findMany({
        where: { tenantId },
        orderBy: { documentType: "asc" }
      });
    }
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentType: row.documentType,
        viewRoles: row.viewRoles,
        editRoles: row.editRoles,
        approveRoles: row.approveRoles,
        relatedModuleHint: row.relatedModuleHint ?? DOCUMENT_TYPE_MODULE_HINTS[row.documentType] ?? null
      })),
      moduleHints: DOCUMENT_TYPE_MODULE_HINTS
    };
  }

  async upsertTypePolicy(
    tenantId: string,
    actorId: string,
    documentType: SsmDocumentType,
    dto: {
      viewRoles?: string[];
      editRoles?: string[];
      approveRoles?: string[];
      relatedModuleHint?: string | null;
    }
  ) {
    const row = await this.prisma.ssmDocumentTypePolicy.upsert({
      where: { tenantId_documentType: { tenantId, documentType } },
      create: {
        tenantId,
        documentType,
        viewRoles: dto.viewRoles ?? [],
        editRoles: dto.editRoles ?? [],
        approveRoles: dto.approveRoles ?? [],
        relatedModuleHint: dto.relatedModuleHint ?? DOCUMENT_TYPE_MODULE_HINTS[documentType] ?? null
      },
      update: {
        viewRoles: dto.viewRoles,
        editRoles: dto.editRoles,
        approveRoles: dto.approveRoles,
        relatedModuleHint: dto.relatedModuleHint
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SSM",
      action: "DOCUMENT_TYPE_POLICY_UPSERTED",
      entityType: "SsmDocumentTypePolicy",
      entityId: row.id,
      payload: { documentType }
    });
    return {
      id: row.id,
      documentType: row.documentType,
      viewRoles: row.viewRoles,
      editRoles: row.editRoles,
      approveRoles: row.approveRoles,
      relatedModuleHint: row.relatedModuleHint
    };
  }

  async seedDefaultTypePolicies(tenantId: string) {
    const defaults = defaultPoliciesForSeed(tenantId);
    let created = 0;
    for (const item of defaults) {
      const existing = await this.prisma.ssmDocumentTypePolicy.findUnique({
        where: { tenantId_documentType: { tenantId, documentType: item.documentType } }
      });
      if (existing) continue;
      await this.prisma.ssmDocumentTypePolicy.create({ data: item });
      created += 1;
    }
    return { created };
  }

  documentModuleHints() {
    return DOCUMENT_TYPE_MODULE_HINTS;
  }
}
