-- AlterEnum (append — safe inside migration transaction on PG 12+)
ALTER TYPE "SsmEipMovementType" ADD VALUE IF NOT EXISTS 'INTAKE';

-- AlterTable SsmEipStock: location scope
ALTER TABLE "SsmEipStock" ADD COLUMN IF NOT EXISTS "worksiteId" TEXT;
ALTER TABLE "SsmEipStock" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "SsmEipStock" ADD COLUMN IF NOT EXISTS "scopeKey" TEXT NOT NULL DEFAULT 'global';

DROP INDEX IF EXISTS "SsmEipStock_tenantId_eipTypeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SsmEipStock_tenantId_eipTypeId_scopeKey_key"
  ON "SsmEipStock"("tenantId", "eipTypeId", "scopeKey");
CREATE INDEX IF NOT EXISTS "SsmEipStock_tenantId_worksiteId_idx" ON "SsmEipStock"("tenantId", "worksiteId");
CREATE INDEX IF NOT EXISTS "SsmEipStock_tenantId_departmentId_idx" ON "SsmEipStock"("tenantId", "departmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmEipStock_worksiteId_fkey'
  ) THEN
    ALTER TABLE "SsmEipStock"
      ADD CONSTRAINT "SsmEipStock_worksiteId_fkey"
      FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmEipStock_departmentId_fkey'
  ) THEN
    ALTER TABLE "SsmEipStock"
      ADD CONSTRAINT "SsmEipStock_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable SsmEipMovement: optional employee + location
ALTER TABLE "SsmEipMovement" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "worksiteId" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

CREATE INDEX IF NOT EXISTS "SsmEipMovement_tenantId_worksiteId_idx" ON "SsmEipMovement"("tenantId", "worksiteId");
CREATE INDEX IF NOT EXISTS "SsmEipMovement_tenantId_departmentId_idx" ON "SsmEipMovement"("tenantId", "departmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmEipMovement_worksiteId_fkey'
  ) THEN
    ALTER TABLE "SsmEipMovement"
      ADD CONSTRAINT "SsmEipMovement_worksiteId_fkey"
      FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmEipMovement_departmentId_fkey'
  ) THEN
    ALTER TABLE "SsmEipMovement"
      ADD CONSTRAINT "SsmEipMovement_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
