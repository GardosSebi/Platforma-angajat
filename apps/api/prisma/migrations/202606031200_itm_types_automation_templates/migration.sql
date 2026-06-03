-- Rol inspector ITM, categorii mesaje, tipuri sondaj, șabloane documente SSM, automatizări (closesAt).

ALTER TYPE "SystemRole" ADD VALUE IF NOT EXISTS 'ITM_INSPECTOR';

CREATE TYPE "CommunicationCategory" AS ENUM (
  'GENERAL',
  'SAFETY_ALERT',
  'POLICY',
  'TRAINING_INFO',
  'SSM_COMPLIANCE',
  'HR_INFO'
);

ALTER TABLE "CommunicationAnnouncement"
  ADD COLUMN IF NOT EXISTS "category" "CommunicationCategory" NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "CommunicationTemplate"
  ADD COLUMN IF NOT EXISTS "category" "CommunicationCategory" NOT NULL DEFAULT 'GENERAL';

CREATE TYPE "SurveyType" AS ENUM (
  'ENGAGEMENT',
  'COMPLIANCE',
  'FEEDBACK',
  'EXIT',
  'PULSE',
  'CUSTOM'
);

ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "surveyType" "SurveyType" NOT NULL DEFAULT 'ENGAGEMENT';

ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "closesAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Survey_tenantId_status_closesAt_idx"
  ON "Survey"("tenantId", "status", "closesAt");

ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'NUMBER';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'RATING_NPS';

CREATE TABLE IF NOT EXISTS "SsmDocumentTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "SsmDocumentType" NOT NULL,
  "targetType" "SsmDocumentTargetType" NOT NULL DEFAULT 'ENTITY',
  "targetLabel" TEXT,
  "isControlFolder" BOOLEAN NOT NULL DEFAULT false,
  "checklistItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SsmDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SsmDocumentTemplate_tenantId_name_key"
  ON "SsmDocumentTemplate"("tenantId", "name");

CREATE INDEX IF NOT EXISTS "SsmDocumentTemplate_tenantId_type_active_idx"
  ON "SsmDocumentTemplate"("tenantId", "type", "active");

ALTER TABLE "SsmDocumentTemplate"
  ADD CONSTRAINT "SsmDocumentTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
