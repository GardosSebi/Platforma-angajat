-- CreateEnum
CREATE TYPE "SsmDangerousSubstanceStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SsmDangerousSubstanceUnit" AS ENUM ('KG', 'L', 'G', 'ML', 'PCS', 'M3');

-- CreateEnum
CREATE TYPE "SsmDangerousSubstanceHazard" AS ENUM ('FLAMMABLE', 'TOXIC', 'CORROSIVE', 'EXPLOSIVE', 'OXIDIZING', 'HARMFUL', 'ENVIRONMENTAL', 'COMPRESSED_GAS', 'OTHER');

-- CreateTable
CREATE TABLE "SsmMedicalReminderDispatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicalControlId" TEXT NOT NULL,
    "daysUntilDue" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmMedicalReminderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmDangerousSubstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "casNumber" TEXT,
    "unNumber" TEXT,
    "hazardClass" "SsmDangerousSubstanceHazard" NOT NULL DEFAULT 'OTHER',
    "location" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" "SsmDangerousSubstanceUnit" NOT NULL DEFAULT 'L',
    "containerType" TEXT,
    "sdsSheetPath" TEXT,
    "sdsSheetName" TEXT,
    "sdsSheetMime" TEXT,
    "sdsSheetSize" INTEGER,
    "sdsValidUntil" TIMESTAMP(3),
    "responsibleName" TEXT,
    "notes" TEXT,
    "status" "SsmDangerousSubstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmDangerousSubstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsmMedicalReminder_unique_dispatch" ON "SsmMedicalReminderDispatch"("medicalControlId", "daysUntilDue", "channel");

-- CreateIndex
CREATE INDEX "SsmMedicalReminderDispatch_tenantId_sentAt_idx" ON "SsmMedicalReminderDispatch"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "SsmDangerousSubstance_tenantId_worksiteId_status_idx" ON "SsmDangerousSubstance"("tenantId", "worksiteId", "status");

-- CreateIndex
CREATE INDEX "SsmDangerousSubstance_tenantId_sdsValidUntil_idx" ON "SsmDangerousSubstance"("tenantId", "sdsValidUntil");

-- CreateIndex
CREATE INDEX "SsmDangerousSubstance_tenantId_casNumber_idx" ON "SsmDangerousSubstance"("tenantId", "casNumber");

-- CreateIndex
CREATE INDEX "SsmDangerousSubstance_tenantId_name_idx" ON "SsmDangerousSubstance"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "SsmMedicalReminderDispatch" ADD CONSTRAINT "SsmMedicalReminderDispatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmMedicalReminderDispatch" ADD CONSTRAINT "SsmMedicalReminderDispatch_medicalControlId_fkey" FOREIGN KEY ("medicalControlId") REFERENCES "SsmMedicalControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmDangerousSubstance" ADD CONSTRAINT "SsmDangerousSubstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmDangerousSubstance" ADD CONSTRAINT "SsmDangerousSubstance_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
