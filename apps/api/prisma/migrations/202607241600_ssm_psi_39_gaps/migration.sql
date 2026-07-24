-- PSI 3.9 gaps: equipment categories + reminder dispatch dedupe

DO $$ BEGIN
  CREATE TYPE "SsmPsiEquipmentCategory" AS ENUM ('EXTINGUISHER', 'HYDRANT', 'DETECTION_SYSTEM', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Convert free-text category → enum (map known Romanian/English labels)
ALTER TABLE "SsmPsiEquipment" ADD COLUMN IF NOT EXISTS "category_new" "SsmPsiEquipmentCategory";

UPDATE "SsmPsiEquipment"
SET "category_new" = CASE
  WHEN lower(coalesce("category", '')) LIKE '%sting%' OR lower(coalesce("category", '')) LIKE '%exting%' THEN 'EXTINGUISHER'::"SsmPsiEquipmentCategory"
  WHEN lower(coalesce("category", '')) LIKE '%hidrant%' OR lower(coalesce("category", '')) LIKE '%hydrant%' THEN 'HYDRANT'::"SsmPsiEquipmentCategory"
  WHEN lower(coalesce("category", '')) LIKE '%detect%' OR lower(coalesce("category", '')) LIKE '%senor%' OR lower(coalesce("category", '')) LIKE '%sensor%' THEN 'DETECTION_SYSTEM'::"SsmPsiEquipmentCategory"
  ELSE 'OTHER'::"SsmPsiEquipmentCategory"
END
WHERE "category_new" IS NULL;

ALTER TABLE "SsmPsiEquipment" DROP COLUMN IF EXISTS "category";
ALTER TABLE "SsmPsiEquipment" RENAME COLUMN "category_new" TO "category";
ALTER TABLE "SsmPsiEquipment" ALTER COLUMN "category" SET DEFAULT 'OTHER'::"SsmPsiEquipmentCategory";
ALTER TABLE "SsmPsiEquipment" ALTER COLUMN "category" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SsmPsiEquipment_tenantId_category_idx"
  ON "SsmPsiEquipment"("tenantId", "category");

CREATE TABLE IF NOT EXISTS "SsmPsiReminderDispatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "daysUntilDue" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmPsiReminderDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SsmPsiReminderDispatch_equipmentId_daysUntilDue_channel_key"
  ON "SsmPsiReminderDispatch"("equipmentId", "daysUntilDue", "channel");

CREATE INDEX IF NOT EXISTS "SsmPsiReminderDispatch_tenantId_sentAt_idx"
  ON "SsmPsiReminderDispatch"("tenantId", "sentAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPsiReminderDispatch_tenantId_fkey'
  ) THEN
    ALTER TABLE "SsmPsiReminderDispatch"
      ADD CONSTRAINT "SsmPsiReminderDispatch_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPsiReminderDispatch_equipmentId_fkey'
  ) THEN
    ALTER TABLE "SsmPsiReminderDispatch"
      ADD CONSTRAINT "SsmPsiReminderDispatch_equipmentId_fkey"
      FOREIGN KEY ("equipmentId") REFERENCES "SsmPsiEquipment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
