import { access, constants, readFile } from "fs/promises";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ItmInspectionVisitStatus, SsmDocumentStatus, SsmDocumentTargetType } from "@prisma/client";
import JSZip from "jszip";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { SystemRole } from "../../../../common/prisma-enums";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { ItmAccessService } from "./itm-access.service";
import { CloseItmInspectionVisitDto, CreateItmInspectionVisitDto } from "../../api/dto/itm-inspection.dto";

@Injectable()
export class SsmItmPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly itmAccess: ItmAccessService,
    private readonly auditLog: AuditLogService
  ) {}

  async listWorksites(tenantId: string) {
    const rows = await this.prisma.worksite.findMany({
      where: { tenantId, active: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" }
    });
    return { items: rows };
  }

  async controlFolders(tenantId: string, viewer: JwtPayload, worksiteId?: string) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    if (worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: worksiteId, tenantId },
        select: { id: true }
      });
      if (!worksite) throw new NotFoundException("Punct de lucru invalid.");
    }

    const rows = await this.prisma.ssmDocument.findMany({
      where: {
        tenantId,
        isControlFolder: true,
        status: SsmDocumentStatus.APPROVED
      },
      include: { activeVersion: true },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }]
    });

    const filtered = rows.filter((row) => {
      if (!worksiteId) return true;
      if (row.targetType === SsmDocumentTargetType.ALL) return true;
      if (row.targetType === SsmDocumentTargetType.ENTITY) return true;
      return row.targetType === SsmDocumentTargetType.WORKSITE && row.targetRefId === worksiteId;
    });

    const grouped = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const key = `${row.type}/${row.targetType}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    await this.itmAccess.logAccess(tenantId, viewer.sub, "VIEW", "ItmControlFolder", worksiteId ?? "all", {
      documentCount: filtered.length
    });

    return {
      folders: Array.from(grouped.entries()).map(([key, docs]) => ({
        key,
        label: key.replace("_", " "),
        count: docs.length,
        documents: docs.filter((doc) => doc.activeVersion)
      }))
    };
  }

  async listVisits(tenantId: string, viewer: JwtPayload, worksiteId?: string) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const isInspector = viewer.roles?.includes(SystemRole.ITM_INSPECTOR);
    const rows = await this.prisma.itmInspectionVisit.findMany({
      where: {
        tenantId,
        ...(worksiteId ? { worksiteId } : {}),
        ...(isInspector ? { inspectorUserId: viewer.sub } : {})
      },
      include: { worksite: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 100
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        worksiteId: row.worksiteId,
        worksiteName: row.worksite?.name ?? null,
        inspectorUserId: row.inspectorUserId,
        inspectorName: row.inspectorName,
        status: row.status,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        notes: row.notes
      }))
    };
  }

  async startVisit(tenantId: string, viewer: JwtPayload, dto: CreateItmInspectionVisitDto) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    if (dto.worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: dto.worksiteId, tenantId, active: true }
      });
      if (!worksite) throw new NotFoundException("Punct de lucru invalid.");
    }
    const user = await this.prisma.user.findFirst({
      where: { id: viewer.sub, tenantId },
      select: { fullName: true, email: true }
    });
    const visit = await this.prisma.itmInspectionVisit.create({
      data: {
        tenantId,
        worksiteId: dto.worksiteId?.trim() || null,
        inspectorUserId: viewer.sub,
        inspectorName: user?.fullName || user?.email || null,
        notes: dto.notes?.trim() || null
      },
      include: { worksite: { select: { name: true } } }
    });
    await this.itmAccess.logAccess(tenantId, viewer.sub, "VISIT_START", "ItmInspectionVisit", visit.id, {
      worksiteId: visit.worksiteId
    });
    return {
      id: visit.id,
      worksiteId: visit.worksiteId,
      worksiteName: visit.worksite?.name ?? null,
      inspectorUserId: visit.inspectorUserId,
      inspectorName: visit.inspectorName,
      status: visit.status,
      startedAt: visit.startedAt,
      endedAt: visit.endedAt,
      notes: visit.notes
    };
  }

  async closeVisit(
    tenantId: string,
    viewer: JwtPayload,
    visitId: string,
    dto: CloseItmInspectionVisitDto
  ) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const visit = await this.prisma.itmInspectionVisit.findFirst({
      where: { id: visitId, tenantId }
    });
    if (!visit) throw new NotFoundException("Vizita ITM nu a fost găsită.");
    if (visit.status === ItmInspectionVisitStatus.CLOSED) {
      throw new BadRequestException("Vizita este deja închisă.");
    }
    const updated = await this.prisma.itmInspectionVisit.update({
      where: { id: visitId },
      data: {
        status: ItmInspectionVisitStatus.CLOSED,
        endedAt: new Date(),
        notes: dto.notes?.trim() || visit.notes
      },
      include: { worksite: { select: { name: true } } }
    });
    await this.itmAccess.logAccess(tenantId, viewer.sub, "VISIT_CLOSE", "ItmInspectionVisit", visitId);
    return {
      id: updated.id,
      worksiteId: updated.worksiteId,
      worksiteName: updated.worksite?.name ?? null,
      inspectorUserId: updated.inspectorUserId,
      inspectorName: updated.inspectorName,
      status: updated.status,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      notes: updated.notes
    };
  }

  async exportControlPackage(tenantId: string, viewer: JwtPayload, worksiteId?: string) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const folders = await this.controlFolders(tenantId, viewer, worksiteId);
    const zip = new JSZip();
    const warnings: string[] = [];
    let added = 0;

    zip.file(
      "manifest.txt",
      [
        "Pachet control ITM/ISU",
        `Generat: ${new Date().toISOString()}`,
        `Punct de lucru: ${worksiteId ?? "toate"}`,
        `Documente: ${folders.folders.reduce((sum, f) => sum + f.count, 0)}`
      ].join("\n")
    );

    for (const folder of folders.folders) {
      for (const doc of folder.documents) {
        const version = doc.activeVersion;
        if (!version?.storagePath) continue;
        try {
          await access(version.storagePath, constants.R_OK);
          const buffer = await readFile(version.storagePath);
          const safeName = `${folder.key}/${doc.title}-${version.fileName}`.replace(/[^\w./-]+/g, "_");
          zip.file(`documente/${safeName}`, buffer);
          added += 1;
        } catch {
          warnings.push(`Lipsește fișierul pentru ${doc.title}`);
        }
      }
    }

    const accidents = await this.prisma.ssmAccidentCase.findMany({
      where: { tenantId, ...(worksiteId ? { worksiteId } : {}) },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        occurredAt: true,
        itmDaysOff: true
      },
      orderBy: { occurredAt: "desc" },
      take: 200
    });
    zip.file("accidente.json", JSON.stringify(accidents, null, 2));

    if (warnings.length) {
      zip.file("warnings.txt", warnings.map((line) => `- ${line}`).join("\n"));
    }

    await this.itmAccess.logAccess(tenantId, viewer.sub, "EXPORT", "ItmControlPackage", worksiteId ?? "all", {
      files: added
    });
    await this.auditLog.write({
      tenantId,
      actorId: viewer.sub,
      module: "SSM",
      action: "ITM_CONTROL_PACKAGE_EXPORTED",
      entityType: "ItmControlPackage",
      entityId: worksiteId ?? "all",
      payload: { files: added }
    });

    return zip.generateAsync({ type: "nodebuffer" });
  }

  async listAccessLogsForViewer(tenantId: string, viewer: JwtPayload, limit = 200) {
    await this.itmAccess.assertItmInspectorAccess(tenantId, viewer.sub, viewer.roles ?? []);
    const isInspectorOnly = viewer.roles?.includes(SystemRole.ITM_INSPECTOR) && !viewer.roles.includes(SystemRole.SSM_ADMIN);
    return this.itmAccess.listAccessLogs(tenantId, limit, isInspectorOnly ? viewer.sub : undefined);
  }
}
