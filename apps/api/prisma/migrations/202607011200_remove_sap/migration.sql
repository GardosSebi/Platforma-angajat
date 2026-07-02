-- Remove SAP B1 integration artifacts

DROP TABLE IF EXISTS "SapEmployeeSyncConflict";
DROP TABLE IF EXISTS "SapEmployeeSyncRun";

DROP INDEX IF EXISTS "Employee_tenantId_sapExternalId_idx";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "sapExternalId";
