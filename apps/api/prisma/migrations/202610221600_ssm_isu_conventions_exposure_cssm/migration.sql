-- CreateEnum
CREATE TYPE "SsmExposureSheetStatus" AS ENUM ('PENDING_SIGNATURE', 'SIGNED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SsmExposureSheetTrigger" AS ENUM ('HIRE', 'JOB_CHANGE', 'RISK_UPDATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SsmConventionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- AlterTable
ALTER TABLE "SsmCssmCommittee" ADD COLUMN     "cadenceReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "meetingIntervalMonths" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "SsmCssmMeeting" ADD COLUMN     "minutesDocumentId" TEXT,
ADD COLUMN     "notificationsSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SsmExposureSheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobPositionId" TEXT,
    "riskAssessmentId" TEXT,
    "riskAssessmentVersionId" TEXT,
    "riskAssessmentVersionNumber" INTEGER,
    "riskLevel" INTEGER,
    "trigger" "SsmExposureSheetTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "SsmExposureSheetStatus" NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "snapshot" JSONB NOT NULL,
    "employeeSignature" TEXT,
    "employeeSignedAt" TIMESTAMP(3),
    "assessorName" TEXT,
    "assessorFunction" TEXT,
    "assessorSignature" TEXT,
    "assessorSignedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "pdfFileName" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmExposureSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmConvention" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activityDescription" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "SsmConventionStatus" NOT NULL DEFAULT 'DRAFT',
    "coordinatorName" TEXT,
    "coordinatorFunction" TEXT,
    "coordinatorEmail" TEXT,
    "sharedRisks" TEXT,
    "preventionMeasures" TEXT,
    "emergencyArrangements" TEXT,
    "trainingArrangements" TEXT,
    "eipArrangements" TEXT,
    "notes" TEXT,
    "documentId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "expiryReminderSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmConvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmConventionParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT NOT NULL,
    "cui" TEXT,
    "representativeName" TEXT NOT NULL,
    "representativeFunction" TEXT,
    "ssmContactName" TEXT,
    "ssmContactPhone" TEXT,
    "ssmContactEmail" TEXT,
    "workersCount" INTEGER,
    "obligations" TEXT,
    "signature" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmConventionParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SsmExposureSheet_tenantId_employeeId_status_idx" ON "SsmExposureSheet"("tenantId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "SsmExposureSheet_tenantId_status_idx" ON "SsmExposureSheet"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SsmExposureSheet_tenantId_riskAssessmentId_idx" ON "SsmExposureSheet"("tenantId", "riskAssessmentId");

-- CreateIndex
CREATE INDEX "SsmConvention_tenantId_worksiteId_status_idx" ON "SsmConvention"("tenantId", "worksiteId", "status");

-- CreateIndex
CREATE INDEX "SsmConvention_tenantId_status_endsAt_idx" ON "SsmConvention"("tenantId", "status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsmConvention_tenantId_number_key" ON "SsmConvention"("tenantId", "number");

-- CreateIndex
CREATE INDEX "SsmConventionParty_tenantId_conventionId_idx" ON "SsmConventionParty"("tenantId", "conventionId");

-- CreateIndex
CREATE INDEX "SsmConventionParty_tenantId_companyName_idx" ON "SsmConventionParty"("tenantId", "companyName");

-- AddForeignKey
ALTER TABLE "SsmExposureSheet" ADD CONSTRAINT "SsmExposureSheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmExposureSheet" ADD CONSTRAINT "SsmExposureSheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmConvention" ADD CONSTRAINT "SsmConvention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmConvention" ADD CONSTRAINT "SsmConvention_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmConvention" ADD CONSTRAINT "SsmConvention_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmConventionParty" ADD CONSTRAINT "SsmConventionParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmConventionParty" ADD CONSTRAINT "SsmConventionParty_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "SsmConvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

