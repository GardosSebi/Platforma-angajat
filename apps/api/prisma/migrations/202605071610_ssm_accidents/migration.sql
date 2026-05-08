-- CreateEnum
CREATE TYPE "SsmAccidentType" AS ENUM ('ACCIDENT', 'INCIDENT', 'OCCUPATIONAL_DISEASE');
CREATE TYPE "SsmAccidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SsmAccidentCaseStatus" AS ENUM ('OPEN', 'IN_RESEARCH', 'MEASURES_DEFINED', 'CLOSED');

-- CreateTable
CREATE TABLE "SsmAccidentCase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT,
  "type" "SsmAccidentType" NOT NULL,
  "severity" "SsmAccidentSeverity" NOT NULL,
  "status" "SsmAccidentCaseStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "description" TEXT NOT NULL,
  "conclusions" TEXT,
  "correctiveMeasures" TEXT,
  "legalDaysDeadline" INTEGER NOT NULL DEFAULT 30,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmAccidentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmAccidentTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accidentCaseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assignedTo" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmAccidentTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SsmAccidentCase_tenantId_status_dueAt_idx" ON "SsmAccidentCase"("tenantId", "status", "dueAt");
CREATE INDEX "SsmAccidentCase_tenantId_type_occurredAt_idx" ON "SsmAccidentCase"("tenantId", "type", "occurredAt");
CREATE INDEX "SsmAccidentTask_tenantId_dueAt_completedAt_idx" ON "SsmAccidentTask"("tenantId", "dueAt", "completedAt");
CREATE INDEX "SsmAccidentTask_tenantId_accidentCaseId_idx" ON "SsmAccidentTask"("tenantId", "accidentCaseId");

ALTER TABLE "SsmAccidentCase"
ADD CONSTRAINT "SsmAccidentCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmAccidentCase"
ADD CONSTRAINT "SsmAccidentCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SsmAccidentTask"
ADD CONSTRAINT "SsmAccidentTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmAccidentTask"
ADD CONSTRAINT "SsmAccidentTask_accidentCaseId_fkey" FOREIGN KEY ("accidentCaseId") REFERENCES "SsmAccidentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
