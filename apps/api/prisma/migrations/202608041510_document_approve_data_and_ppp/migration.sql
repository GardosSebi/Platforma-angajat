-- Uses APPROVED after it was committed in the previous migration.
ALTER TABLE "SsmDocument" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "SsmDocument" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- Existing active documents become approved so employee visibility stays intact
UPDATE "SsmDocument" SET "status" = 'APPROVED' WHERE "status" = 'ACTIVE';

-- PPP versioning
ALTER TABLE "SsmPreventionPlan" ADD COLUMN IF NOT EXISTS "activeVersionId" TEXT;

CREATE TABLE IF NOT EXISTS "SsmPreventionPlanVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "updateReason" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "measures" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmPreventionPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SsmPreventionPlanVersion_planId_versionNumber_key"
  ON "SsmPreventionPlanVersion"("planId", "versionNumber");

CREATE INDEX IF NOT EXISTS "SsmPreventionPlanVersion_tenantId_planId_createdAt_idx"
  ON "SsmPreventionPlanVersion"("tenantId", "planId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPreventionPlanVersion_tenantId_fkey'
  ) THEN
    ALTER TABLE "SsmPreventionPlanVersion"
      ADD CONSTRAINT "SsmPreventionPlanVersion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPreventionPlanVersion_planId_fkey'
  ) THEN
    ALTER TABLE "SsmPreventionPlanVersion"
      ADD CONSTRAINT "SsmPreventionPlanVersion_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "SsmPreventionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPreventionPlan_activeVersionId_fkey'
  ) THEN
    ALTER TABLE "SsmPreventionPlan"
      ADD CONSTRAINT "SsmPreventionPlan_activeVersionId_fkey"
      FOREIGN KEY ("activeVersionId") REFERENCES "SsmPreventionPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed version 1 for existing PPP plans from live measures
INSERT INTO "SsmPreventionPlanVersion" (
  "id", "tenantId", "planId", "versionNumber", "updateReason", "reviewDate", "notes", "measures", "createdBy", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  p."tenantId",
  p."id",
  1,
  'Versiune inițială (migrare)',
  p."reviewDate",
  p."notes",
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'description', m."description",
          'responsiblePerson', m."responsiblePerson",
          'dueDate', CASE WHEN m."dueDate" IS NULL THEN NULL ELSE to_char(m."dueDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
          'status', m."status"::text,
          'notes', m."notes"
        )
        ORDER BY m."createdAt"
      )
      FROM "SsmPreventionMeasure" m
      WHERE m."planId" = p."id"
    ),
    '[]'::jsonb
  ),
  p."createdBy",
  p."createdAt"
FROM "SsmPreventionPlan" p
WHERE NOT EXISTS (
  SELECT 1 FROM "SsmPreventionPlanVersion" v WHERE v."planId" = p."id"
);

UPDATE "SsmPreventionPlan" p
SET "activeVersionId" = v."id"
FROM "SsmPreventionPlanVersion" v
WHERE v."planId" = p."id"
  AND v."versionNumber" = 1
  AND p."activeVersionId" IS NULL;
