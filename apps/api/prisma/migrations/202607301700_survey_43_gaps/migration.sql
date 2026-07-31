-- AlterTable
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "opensAt" TIMESTAMP(3);
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "responseLimit" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Survey_tenantId_status_opensAt_idx" ON "Survey"("tenantId", "status", "opensAt");
