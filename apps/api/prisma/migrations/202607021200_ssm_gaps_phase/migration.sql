-- Document types (3.2.1)
ALTER TYPE "SsmDocumentType" ADD VALUE IF NOT EXISTS 'EXPOSURE_SHEET';
ALTER TYPE "SsmDocumentType" ADD VALUE IF NOT EXISTS 'SSM_CONVENTION';
ALTER TYPE "SsmDocumentType" ADD VALUE IF NOT EXISTS 'DANGEROUS_SUBSTANCES';
ALTER TYPE "SsmDocumentType" ADD VALUE IF NOT EXISTS 'EMERGENCY_PROCEDURE';

-- E-learning material tracking (3.3.2)
ALTER TABLE "SsmTrainingPlan" ADD COLUMN IF NOT EXISTS "materialTimeSpentSeconds" INTEGER;

-- Manager approval for workplace training (3.3 / 3.12)
ALTER TABLE "SsmTrainingSignature" ADD COLUMN IF NOT EXISTS "managerSignature" TEXT;
ALTER TABLE "SsmTrainingSignature" ADD COLUMN IF NOT EXISTS "managerSignedAt" TIMESTAMP(3);
ALTER TABLE "SsmTrainingSignature" ADD COLUMN IF NOT EXISTS "managerUserId" TEXT;

-- PPP dedicated module (3.8)
CREATE TYPE "SsmPreventionPlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SsmPreventionMeasureStatus" AS ENUM ('OPEN', 'COMPLETED', 'OVERDUE');

CREATE TABLE "SsmPreventionPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetType" "SsmRiskTargetType" NOT NULL,
    "jobPositionId" TEXT,
    "worksiteId" TEXT,
    "departmentId" TEXT,
    "status" "SsmPreventionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmPreventionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmPreventionMeasure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsiblePerson" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "SsmPreventionMeasureStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmPreventionMeasure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SsmPreventionPlan_tenantId_status_idx" ON "SsmPreventionPlan"("tenantId", "status");
CREATE INDEX "SsmPreventionPlan_tenantId_targetType_idx" ON "SsmPreventionPlan"("tenantId", "targetType");
CREATE INDEX "SsmPreventionMeasure_tenantId_planId_idx" ON "SsmPreventionMeasure"("tenantId", "planId");
CREATE INDEX "SsmPreventionMeasure_tenantId_status_dueDate_idx" ON "SsmPreventionMeasure"("tenantId", "status", "dueDate");

ALTER TABLE "SsmPreventionPlan" ADD CONSTRAINT "SsmPreventionPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPreventionPlan" ADD CONSTRAINT "SsmPreventionPlan_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmPreventionPlan" ADD CONSTRAINT "SsmPreventionPlan_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmPreventionPlan" ADD CONSTRAINT "SsmPreventionPlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmPreventionMeasure" ADD CONSTRAINT "SsmPreventionMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPreventionMeasure" ADD CONSTRAINT "SsmPreventionMeasure_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SsmPreventionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evacuation drill records (3.9)
CREATE TABLE "SsmEvacuationDrill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "conductedAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "participantsCount" INTEGER,
    "result" TEXT NOT NULL,
    "coordinatorName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmEvacuationDrill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SsmEvacuationDrill_tenantId_worksiteId_conductedAt_idx" ON "SsmEvacuationDrill"("tenantId", "worksiteId", "conductedAt");
CREATE INDEX "SsmEvacuationDrill_tenantId_nextDueAt_idx" ON "SsmEvacuationDrill"("tenantId", "nextDueAt");

ALTER TABLE "SsmEvacuationDrill" ADD CONSTRAINT "SsmEvacuationDrill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEvacuationDrill" ADD CONSTRAINT "SsmEvacuationDrill_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
