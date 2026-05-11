-- CreateEnum
CREATE TYPE "SsmTrainingCategory" AS ENUM (
  'INTRODUCTORY_GENERAL',
  'WORKPLACE',
  'PERIODIC',
  'SUPPLEMENTARY',
  'EMERGENCY_PSI'
);

-- AlterTable
ALTER TABLE "SsmTrainingType"
ADD COLUMN "category" "SsmTrainingCategory" NOT NULL DEFAULT 'PERIODIC',
ADD COLUMN "legalMinDurationHours" INTEGER;

-- CreateTable
CREATE TABLE "SsmTrainingReminderDispatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "trainingPlanId" TEXT NOT NULL,
  "daysUntilDue" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmTrainingReminderDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsmTrainingReminderDispatch_trainingPlanId_daysUntilDue_cha_key"
ON "SsmTrainingReminderDispatch"("trainingPlanId", "daysUntilDue", "channel");
CREATE INDEX "SsmTrainingReminderDispatch_tenantId_sentAt_idx"
ON "SsmTrainingReminderDispatch"("tenantId", "sentAt");

ALTER TABLE "SsmTrainingReminderDispatch"
ADD CONSTRAINT "SsmTrainingReminderDispatch_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmTrainingReminderDispatch"
ADD CONSTRAINT "SsmTrainingReminderDispatch_trainingPlanId_fkey"
FOREIGN KEY ("trainingPlanId") REFERENCES "SsmTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
