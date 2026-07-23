-- AlterTable SsmAccidentCase: near-miss, occupational disease, org links, research responsible
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "worksiteId" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "contributingFactors" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "immediateMeasures" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "diseaseConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "diseaseConfirmedAt" TIMESTAMP(3);
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "diseaseConfirmedBy" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "diseaseDocumentRef" TEXT;
ALTER TABLE "SsmAccidentCase" ADD COLUMN IF NOT EXISTS "researchResponsible" TEXT;

CREATE INDEX IF NOT EXISTS "SsmAccidentCase_tenantId_worksiteId_idx" ON "SsmAccidentCase"("tenantId", "worksiteId");
CREATE INDEX IF NOT EXISTS "SsmAccidentCase_tenantId_departmentId_idx" ON "SsmAccidentCase"("tenantId", "departmentId");

DO $$ BEGIN
  ALTER TABLE "SsmAccidentCase"
    ADD CONSTRAINT "SsmAccidentCase_worksiteId_fkey"
    FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SsmAccidentCase"
    ADD CONSTRAINT "SsmAccidentCase_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable structured corrective measures
CREATE TABLE IF NOT EXISTS "SsmAccidentCorrectiveMeasure" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accidentCaseId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "assignedTo" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmAccidentCorrectiveMeasure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SsmAccidentCorrectiveMeasure_tenantId_dueAt_completedAt_idx"
  ON "SsmAccidentCorrectiveMeasure"("tenantId", "dueAt", "completedAt");
CREATE INDEX IF NOT EXISTS "SsmAccidentCorrectiveMeasure_tenantId_accidentCaseId_idx"
  ON "SsmAccidentCorrectiveMeasure"("tenantId", "accidentCaseId");

DO $$ BEGIN
  ALTER TABLE "SsmAccidentCorrectiveMeasure"
    ADD CONSTRAINT "SsmAccidentCorrectiveMeasure_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SsmAccidentCorrectiveMeasure"
    ADD CONSTRAINT "SsmAccidentCorrectiveMeasure_accidentCaseId_fkey"
    FOREIGN KEY ("accidentCaseId") REFERENCES "SsmAccidentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
