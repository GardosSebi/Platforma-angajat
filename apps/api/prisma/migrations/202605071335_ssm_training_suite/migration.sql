-- CreateEnum
CREATE TYPE "SsmTrainingPlanStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'BLOCKED');

-- CreateTable
CREATE TABLE "SsmTrainingType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "recurrenceDays" INTEGER,
  "reminderDays" INTEGER[] DEFAULT ARRAY[30, 15, 7]::INTEGER[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmTrainingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmTrainingPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "trainingTypeId" TEXT NOT NULL,
  "materialTitle" TEXT,
  "materialUrl" TEXT,
  "materialCompletedAt" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "durationMinutes" INTEGER,
  "status" "SsmTrainingPlanStatus" NOT NULL DEFAULT 'PENDING',
  "blockedAdmission" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmTrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmTrainingTestAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "trainingPlanId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "durationSeconds" INTEGER,
  "passed" BOOLEAN,
  "answersJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmTrainingTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmTrainingSignature" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "trainingPlanId" TEXT NOT NULL,
  "employeeSignature" TEXT,
  "responsibleSignature" TEXT,
  "employeeSignedAt" TIMESTAMP(3),
  "responsibleSignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmTrainingSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsmTrainingType_tenantId_code_key" ON "SsmTrainingType"("tenantId", "code");
CREATE INDEX "SsmTrainingType_tenantId_active_idx" ON "SsmTrainingType"("tenantId", "active");

CREATE INDEX "SsmTrainingPlan_tenantId_employeeId_status_idx" ON "SsmTrainingPlan"("tenantId", "employeeId", "status");
CREATE INDEX "SsmTrainingPlan_tenantId_dueAt_status_idx" ON "SsmTrainingPlan"("tenantId", "dueAt", "status");
CREATE INDEX "SsmTrainingPlan_tenantId_blockedAdmission_idx" ON "SsmTrainingPlan"("tenantId", "blockedAdmission");

CREATE INDEX "SsmTrainingTestAttempt_tenantId_trainingPlanId_startedAt_idx" ON "SsmTrainingTestAttempt"("tenantId", "trainingPlanId", "startedAt");
CREATE UNIQUE INDEX "SsmTrainingSignature_trainingPlanId_key" ON "SsmTrainingSignature"("trainingPlanId");
CREATE INDEX "SsmTrainingSignature_tenantId_trainingPlanId_idx" ON "SsmTrainingSignature"("tenantId", "trainingPlanId");

ALTER TABLE "SsmTrainingType"
ADD CONSTRAINT "SsmTrainingType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmTrainingPlan"
ADD CONSTRAINT "SsmTrainingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmTrainingPlan"
ADD CONSTRAINT "SsmTrainingPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmTrainingPlan"
ADD CONSTRAINT "SsmTrainingPlan_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "SsmTrainingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmTrainingTestAttempt"
ADD CONSTRAINT "SsmTrainingTestAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmTrainingTestAttempt"
ADD CONSTRAINT "SsmTrainingTestAttempt_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "SsmTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmTrainingSignature"
ADD CONSTRAINT "SsmTrainingSignature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmTrainingSignature"
ADD CONSTRAINT "SsmTrainingSignature_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "SsmTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
