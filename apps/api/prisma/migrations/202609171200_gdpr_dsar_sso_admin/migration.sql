-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "dsarErasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Employee_tenantId_dsarErasedAt_idx" ON "Employee"("tenantId", "dsarErasedAt");
