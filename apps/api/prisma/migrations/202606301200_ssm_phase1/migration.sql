-- SSM Phase 1: entitate juridică, tip angajat, SAP sync, ITM access log, instruire

CREATE TYPE "EmployeeEmploymentType" AS ENUM ('OWN', 'DETACHED', 'TEMPORARY', 'EXTERNAL');

CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cui" TEXT,
    "headquarters" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalEntity_tenantId_code_key" ON "LegalEntity"("tenantId", "code");
CREATE INDEX "LegalEntity_tenantId_active_idx" ON "LegalEntity"("tenantId", "active");

ALTER TABLE "LegalEntity"
ADD CONSTRAINT "LegalEntity_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Worksite" ADD COLUMN "legalEntityId" TEXT;
CREATE INDEX "Worksite_tenantId_legalEntityId_idx" ON "Worksite"("tenantId", "legalEntityId");
ALTER TABLE "Worksite"
ADD CONSTRAINT "Worksite_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobPosition"
ADD COLUMN "legalEntityId" TEXT,
ADD COLUMN "activityDescription" TEXT;
CREATE INDEX "JobPosition_tenantId_legalEntityId_idx" ON "JobPosition"("tenantId", "legalEntityId");
ALTER TABLE "JobPosition"
ADD CONSTRAINT "JobPosition_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Employee"
ADD COLUMN "employmentType" "EmployeeEmploymentType" NOT NULL DEFAULT 'OWN',
ADD COLUMN "absenceStartedAt" TIMESTAMP(3),
ADD COLUMN "sapExternalId" TEXT;
CREATE INDEX "Employee_tenantId_absenceStartedAt_idx" ON "Employee"("tenantId", "absenceStartedAt");
CREATE INDEX "Employee_tenantId_sapExternalId_idx" ON "Employee"("tenantId", "sapExternalId");

ALTER TABLE "SsmResponsible" ADD COLUMN "legalEntityId" TEXT;
CREATE INDEX "SsmResponsible_tenantId_legalEntityId_idx" ON "SsmResponsible"("tenantId", "legalEntityId");
ALTER TABLE "SsmResponsible"
ADD CONSTRAINT "SsmResponsible_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmDocument" ADD COLUMN "legalEntityId" TEXT;
CREATE INDEX "SsmDocument_tenantId_legalEntityId_status_idx" ON "SsmDocument"("tenantId", "legalEntityId", "status");
ALTER TABLE "SsmDocument"
ADD CONSTRAINT "SsmDocument_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmTrainingType" ADD COLUMN "testQuestionsJson" JSONB;

ALTER TABLE "SsmTrainingPlan" ADD COLUMN "materialStartedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "itmAccessExpiresAt" TIMESTAMP(3);

CREATE TABLE "SapEmployeeSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    CONSTRAINT "SapEmployeeSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SapEmployeeSyncRun_tenantId_startedAt_idx" ON "SapEmployeeSyncRun"("tenantId", "startedAt");
ALTER TABLE "SapEmployeeSyncRun"
ADD CONSTRAINT "SapEmployeeSyncRun_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SapEmployeeSyncConflict" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "externalKey" TEXT NOT NULL,
    "email" TEXT,
    "fieldDiffs" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SapEmployeeSyncConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SapEmployeeSyncConflict_tenantId_resolved_createdAt_idx"
ON "SapEmployeeSyncConflict"("tenantId", "resolved", "createdAt");
CREATE INDEX "SapEmployeeSyncConflict_tenantId_syncRunId_idx"
ON "SapEmployeeSyncConflict"("tenantId", "syncRunId");

ALTER TABLE "SapEmployeeSyncConflict"
ADD CONSTRAINT "SapEmployeeSyncConflict_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SapEmployeeSyncConflict"
ADD CONSTRAINT "SapEmployeeSyncConflict_syncRunId_fkey"
FOREIGN KEY ("syncRunId") REFERENCES "SapEmployeeSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ItmAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItmAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItmAccessLog_tenantId_userId_createdAt_idx" ON "ItmAccessLog"("tenantId", "userId", "createdAt");
CREATE INDEX "ItmAccessLog_tenantId_resourceType_createdAt_idx" ON "ItmAccessLog"("tenantId", "resourceType", "createdAt");

ALTER TABLE "ItmAccessLog"
ADD CONSTRAINT "ItmAccessLog_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItmAccessLog"
ADD CONSTRAINT "ItmAccessLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
