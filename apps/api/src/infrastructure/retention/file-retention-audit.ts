import { AuditLogService } from "../logging/audit-log.service";

export const FILE_RETENTION_ARCHIVE_ACTION = "FILE_RETENTION_ARCHIVED";
export const FILE_RETENTION_ACCESS_ACTION = "FILE_RETENTION_ACCESSED";

export type FileRetentionCategory =
  | "DOCUMENT_VERSION"
  | "DOCUMENT_TEMPLATE"
  | "TRAINING_MATERIAL"
  | "TRAINING_SIGNATURE"
  | "EIP_SIGNATURE"
  | "ACCIDENT_ATTACHMENT"
  | "MEDICAL_APTITUDE"
  | "COMMS_MEDIA"
  | "COMMS_TEMPLATE"
  | "SURVEY_ANSWER"
  | "STATIC_PAGE_ATTACHMENT";

export async function auditRetentionFileAccess(
  auditLog: AuditLogService,
  input: {
    tenantId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    category: FileRetentionCategory;
    fileName: string;
    storagePath?: string | null;
    retentionArchivedAt?: Date | null;
  }
) {
  if (!input.retentionArchivedAt) return;
  await auditLog.write({
    tenantId: input.tenantId,
    actorId: input.actorId,
    module: "RETENTION",
    action: FILE_RETENTION_ACCESS_ACTION,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: {
      category: input.category,
      fileName: input.fileName,
      storagePath: input.storagePath ?? null,
      retentionArchivedAt: input.retentionArchivedAt.toISOString()
    }
  });
}
