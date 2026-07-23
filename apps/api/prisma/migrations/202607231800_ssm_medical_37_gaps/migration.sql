-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SsmMedicalControlCategory" AS ENUM ('HIRE', 'PERIODIC', 'RESUME', 'JOB_CHANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add category (default PERIODIC for existing rows)
ALTER TABLE "SsmMedicalControlType" ADD COLUMN IF NOT EXISTS "category" "SsmMedicalControlCategory" NOT NULL DEFAULT 'PERIODIC';

-- Backfill jobPositionId for rows without one (use any active job position in tenant)
UPDATE "SsmMedicalControlType" t
SET "jobPositionId" = (
  SELECT j.id FROM "JobPosition" j
  WHERE j."tenantId" = t."tenantId" AND j.active = true
  ORDER BY j."createdAt" ASC
  LIMIT 1
)
WHERE t."jobPositionId" IS NULL;

-- If still null (tenant without job positions), create cannot proceed — leave nullable temporarily then tighten
-- Drop and recreate FK as required when all rows have values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "SsmMedicalControlType" WHERE "jobPositionId" IS NULL
  ) THEN
    ALTER TABLE "SsmMedicalControlType" ALTER COLUMN "jobPositionId" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SsmMedicalControlType_tenantId_category_jobPositionId_idx"
  ON "SsmMedicalControlType"("tenantId", "category", "jobPositionId");
