-- CreateEnum
CREATE TYPE "SsmMedicalControlResult" AS ENUM ('FIT', 'FIT_CONDITIONAL', 'TEMPORARY_UNFIT', 'UNFIT');

-- CreateTable
CREATE TABLE "SsmMedicalControlType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jobPositionId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "recurrenceDays" INTEGER,
  "reminderDays" INTEGER[] DEFAULT ARRAY[30, 15, 7]::INTEGER[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmMedicalControlType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmMedicalControl" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "controlTypeId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "performedAt" TIMESTAMP(3),
  "result" "SsmMedicalControlResult",
  "recommendations" TEXT,
  "validityUntil" TIMESTAMP(3),
  "nextDueAt" TIMESTAMP(3),
  "aptitudeSheetPath" TEXT,
  "aptitudeSheetName" TEXT,
  "aptitudeSheetMime" TEXT,
  "aptitudeSheetSize" INTEGER,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmMedicalControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsmMedicalControlType_tenantId_code_key" ON "SsmMedicalControlType"("tenantId", "code");
CREATE INDEX "SsmMedicalControlType_tenantId_active_idx" ON "SsmMedicalControlType"("tenantId", "active");
CREATE INDEX "SsmMedicalControlType_tenantId_jobPositionId_idx" ON "SsmMedicalControlType"("tenantId", "jobPositionId");
CREATE INDEX "SsmMedicalControl_tenantId_employeeId_scheduledAt_idx" ON "SsmMedicalControl"("tenantId", "employeeId", "scheduledAt");
CREATE INDEX "SsmMedicalControl_tenantId_nextDueAt_idx" ON "SsmMedicalControl"("tenantId", "nextDueAt");
CREATE INDEX "SsmMedicalControl_tenantId_result_idx" ON "SsmMedicalControl"("tenantId", "result");

ALTER TABLE "SsmMedicalControlType"
ADD CONSTRAINT "SsmMedicalControlType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmMedicalControlType"
ADD CONSTRAINT "SsmMedicalControlType_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmMedicalControl"
ADD CONSTRAINT "SsmMedicalControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmMedicalControl"
ADD CONSTRAINT "SsmMedicalControl_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmMedicalControl"
ADD CONSTRAINT "SsmMedicalControl_controlTypeId_fkey" FOREIGN KEY ("controlTypeId") REFERENCES "SsmMedicalControlType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
