-- AlterTable
ALTER TABLE "SsmDocumentVersion" ADD COLUMN "filePurgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SsmMedicalControl" ADD COLUMN "retentionArchivedAt" TIMESTAMP(3),
ADD COLUMN "filePurgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SsmAccidentAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accidentCaseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "retentionArchivedAt" TIMESTAMP(3),
    "filePurgedAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmAccidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCommunicationPermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSend" BOOLEAN NOT NULL DEFAULT false,
    "canSendExternal" BOOLEAN NOT NULL DEFAULT false,
    "worksiteId" TEXT,
    "employeeGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "UserCommunicationPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SsmAccidentAttachment_tenantId_accidentCaseId_idx" ON "SsmAccidentAttachment"("tenantId", "accidentCaseId");

-- CreateIndex
CREATE INDEX "SsmAccidentAttachment_tenantId_retentionArchivedAt_idx" ON "SsmAccidentAttachment"("tenantId", "retentionArchivedAt");

-- CreateIndex
CREATE INDEX "SsmDocumentVersion_tenantId_filePurgedAt_idx" ON "SsmDocumentVersion"("tenantId", "filePurgedAt");

-- CreateIndex
CREATE INDEX "SsmMedicalControl_tenantId_retentionArchivedAt_idx" ON "SsmMedicalControl"("tenantId", "retentionArchivedAt");

-- CreateIndex
CREATE INDEX "UserCommunicationPermission_tenantId_userId_idx" ON "UserCommunicationPermission"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "UserCommunicationPermission_tenantId_worksiteId_idx" ON "UserCommunicationPermission"("tenantId", "worksiteId");

-- CreateIndex
CREATE INDEX "UserCommunicationPermission_tenantId_employeeGroupId_idx" ON "UserCommunicationPermission"("tenantId", "employeeGroupId");

-- AddForeignKey
ALTER TABLE "SsmAccidentAttachment" ADD CONSTRAINT "SsmAccidentAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsmAccidentAttachment" ADD CONSTRAINT "SsmAccidentAttachment_accidentCaseId_fkey" FOREIGN KEY ("accidentCaseId") REFERENCES "SsmAccidentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationPermission" ADD CONSTRAINT "UserCommunicationPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationPermission" ADD CONSTRAINT "UserCommunicationPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationPermission" ADD CONSTRAINT "UserCommunicationPermission_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationPermission" ADD CONSTRAINT "UserCommunicationPermission_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
