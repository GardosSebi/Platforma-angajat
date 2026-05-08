-- Create enums
CREATE TYPE "SsmDocumentType" AS ENUM (
  'IPSSM',
  'RISK_ASSESSMENT',
  'PPP',
  'THEMATIC',
  'DECISION',
  'PSI',
  'REGISTER',
  'OTHER'
);

CREATE TYPE "SsmDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "SsmDocumentTargetType" AS ENUM ('JOB_POSITION', 'DEPARTMENT', 'WORKSITE', 'ENTITY', 'ALL');

-- CreateTable
CREATE TABLE "SsmDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "SsmDocumentType" NOT NULL,
  "entityName" TEXT,
  "departmentName" TEXT,
  "jobPositionName" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "targetType" "SsmDocumentTargetType" NOT NULL,
  "targetRefId" TEXT,
  "targetLabel" TEXT,
  "status" "SsmDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "isControlFolder" BOOLEAN NOT NULL DEFAULT false,
  "activeVersionId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmDocumentVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "changeNote" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "SsmDocument_tenantId_type_status_idx" ON "SsmDocument" ("tenantId", "type", "status");
CREATE INDEX "SsmDocument_tenantId_targetType_status_idx" ON "SsmDocument" ("tenantId", "targetType", "status");
CREATE INDEX "SsmDocument_tenantId_isControlFolder_status_idx" ON "SsmDocument" ("tenantId", "isControlFolder", "status");
CREATE UNIQUE INDEX "SsmDocumentVersion_documentId_versionNumber_key" ON "SsmDocumentVersion" ("documentId", "versionNumber");
CREATE INDEX "SsmDocumentVersion_tenantId_documentId_createdAt_idx" ON "SsmDocumentVersion" ("tenantId", "documentId", "createdAt");

-- FKs
ALTER TABLE "SsmDocument"
ADD CONSTRAINT "SsmDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmDocument"
ADD CONSTRAINT "SsmDocument_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "SsmDocumentVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmDocumentVersion"
ADD CONSTRAINT "SsmDocumentVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmDocumentVersion"
ADD CONSTRAINT "SsmDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SsmDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
