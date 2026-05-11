CREATE TYPE "SsmRiskAssessmentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SsmRiskTargetType" AS ENUM ('JOB_POSITION', 'WORKSITE', 'DEPARTMENT');
CREATE TYPE "SsmPsiEquipmentStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "SsmPsiResponsibleRole" AS ENUM ('PSI_RESPONSIBLE', 'EMERGENCY_COORDINATOR', 'EVACUATION_RESPONSIBLE', 'FIRST_AID_RESPONSIBLE');

CREATE TABLE "SsmRiskAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetType" "SsmRiskTargetType" NOT NULL,
    "jobPositionId" TEXT,
    "worksiteId" TEXT,
    "departmentId" TEXT,
    "status" "SsmRiskAssessmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmRiskAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmRiskAssessmentVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "updateReason" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "measures" JSONB NOT NULL,
    "riskLevel" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmRiskAssessmentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmPsiEquipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "verificationIntervalDays" INTEGER NOT NULL,
    "reminderDays" INTEGER[] NOT NULL DEFAULT ARRAY[30,15,7]::INTEGER[],
    "lastVerifiedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "status" "SsmPsiEquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmPsiEquipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmPsiEquipmentVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "documentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmPsiEquipmentVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmPsiTrainingRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "employeeId" TEXT,
    "trainingTypeId" TEXT,
    "topic" TEXT NOT NULL,
    "conductedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "trainerName" TEXT NOT NULL,
    "responsibleName" TEXT,
    "evidenceDocumentId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmPsiTrainingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SsmPsiResponsible" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "employeeId" TEXT,
    "role" "SsmPsiResponsibleRole" NOT NULL,
    "personName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmPsiResponsible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsmRiskAssessmentVersion_assessmentId_versionNumber_key" ON "SsmRiskAssessmentVersion"("assessmentId", "versionNumber");
CREATE UNIQUE INDEX "SsmPsiEquipment_tenantId_code_key" ON "SsmPsiEquipment"("tenantId", "code");

CREATE INDEX "SsmRiskAssessment_tenantId_targetType_status_idx" ON "SsmRiskAssessment"("tenantId", "targetType", "status");
CREATE INDEX "SsmRiskAssessment_tenantId_jobPositionId_idx" ON "SsmRiskAssessment"("tenantId", "jobPositionId");
CREATE INDEX "SsmRiskAssessment_tenantId_worksiteId_idx" ON "SsmRiskAssessment"("tenantId", "worksiteId");
CREATE INDEX "SsmRiskAssessment_tenantId_departmentId_idx" ON "SsmRiskAssessment"("tenantId", "departmentId");
CREATE INDEX "SsmRiskAssessmentVersion_tenantId_assessmentId_createdAt_idx" ON "SsmRiskAssessmentVersion"("tenantId", "assessmentId", "createdAt");
CREATE INDEX "SsmRiskAssessmentVersion_tenantId_riskLevel_idx" ON "SsmRiskAssessmentVersion"("tenantId", "riskLevel");
CREATE INDEX "SsmPsiEquipment_tenantId_worksiteId_status_idx" ON "SsmPsiEquipment"("tenantId", "worksiteId", "status");
CREATE INDEX "SsmPsiEquipment_tenantId_nextDueAt_idx" ON "SsmPsiEquipment"("tenantId", "nextDueAt");
CREATE INDEX "SsmPsiEquipmentVerification_tenantId_equipmentId_performedAt_idx" ON "SsmPsiEquipmentVerification"("tenantId", "equipmentId", "performedAt");
CREATE INDEX "SsmPsiEquipmentVerification_tenantId_nextDueAt_idx" ON "SsmPsiEquipmentVerification"("tenantId", "nextDueAt");
CREATE INDEX "SsmPsiTrainingRecord_tenantId_worksiteId_conductedAt_idx" ON "SsmPsiTrainingRecord"("tenantId", "worksiteId", "conductedAt");
CREATE INDEX "SsmPsiTrainingRecord_tenantId_employeeId_idx" ON "SsmPsiTrainingRecord"("tenantId", "employeeId");
CREATE INDEX "SsmPsiTrainingRecord_tenantId_validUntil_idx" ON "SsmPsiTrainingRecord"("tenantId", "validUntil");
CREATE INDEX "SsmPsiResponsible_tenantId_worksiteId_active_idx" ON "SsmPsiResponsible"("tenantId", "worksiteId", "active");
CREATE INDEX "SsmPsiResponsible_tenantId_role_idx" ON "SsmPsiResponsible"("tenantId", "role");

ALTER TABLE "SsmRiskAssessment" ADD CONSTRAINT "SsmRiskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessment" ADD CONSTRAINT "SsmRiskAssessment_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessment" ADD CONSTRAINT "SsmRiskAssessment_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessment" ADD CONSTRAINT "SsmRiskAssessment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessment" ADD CONSTRAINT "SsmRiskAssessment_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "SsmRiskAssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessmentVersion" ADD CONSTRAINT "SsmRiskAssessmentVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmRiskAssessmentVersion" ADD CONSTRAINT "SsmRiskAssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SsmRiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiEquipment" ADD CONSTRAINT "SsmPsiEquipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiEquipment" ADD CONSTRAINT "SsmPsiEquipment_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiEquipmentVerification" ADD CONSTRAINT "SsmPsiEquipmentVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiEquipmentVerification" ADD CONSTRAINT "SsmPsiEquipmentVerification_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "SsmPsiEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiTrainingRecord" ADD CONSTRAINT "SsmPsiTrainingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiTrainingRecord" ADD CONSTRAINT "SsmPsiTrainingRecord_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiTrainingRecord" ADD CONSTRAINT "SsmPsiTrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SsmPsiResponsible" ADD CONSTRAINT "SsmPsiResponsible_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiResponsible" ADD CONSTRAINT "SsmPsiResponsible_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmPsiResponsible" ADD CONSTRAINT "SsmPsiResponsible_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
