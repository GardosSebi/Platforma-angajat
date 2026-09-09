-- AlterEnum
ALTER TYPE "CommunicationAudienceType" ADD VALUE 'EXTERNAL';

-- AlterTable
ALTER TABLE "SsmDocumentTemplate" ADD COLUMN "bodyHtml" TEXT;

-- AlterTable
ALTER TABLE "CommunicationPublishRight" ADD COLUMN "canChat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommunicationPublishRight" ADD COLUMN "canCommunicateExternal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN "targetExternalContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "ExternalContactKind" AS ENUM ('CONTRACTOR', 'PARTNER', 'EXTERNAL_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationChatChannelKind" AS ENUM ('ALL', 'COMPANY', 'GROUP', 'WORKSITE', 'EXTERNAL');

-- CreateTable
CREATE TABLE "ExternalContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "ExternalContactKind" NOT NULL DEFAULT 'PARTNER',
    "organization" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationChatChannel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "CommunicationChatChannelKind" NOT NULL,
    "name" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "employeeGroupId" TEXT,
    "worksiteId" TEXT,
    "externalContactId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationChatMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "emailedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalContact_tenantId_active_idx" ON "ExternalContact"("tenantId", "active");
CREATE INDEX "ExternalContact_tenantId_email_idx" ON "ExternalContact"("tenantId", "email");
CREATE UNIQUE INDEX "ExternalContact_tenantId_email_key" ON "ExternalContact"("tenantId", "email");

-- CreateIndex
CREATE INDEX "CommunicationChatChannel_tenantId_kind_idx" ON "CommunicationChatChannel"("tenantId", "kind");
CREATE INDEX "CommunicationChatChannel_tenantId_legalEntityId_idx" ON "CommunicationChatChannel"("tenantId", "legalEntityId");
CREATE INDEX "CommunicationChatChannel_tenantId_employeeGroupId_idx" ON "CommunicationChatChannel"("tenantId", "employeeGroupId");
CREATE INDEX "CommunicationChatChannel_tenantId_worksiteId_idx" ON "CommunicationChatChannel"("tenantId", "worksiteId");
CREATE INDEX "CommunicationChatChannel_tenantId_externalContactId_idx" ON "CommunicationChatChannel"("tenantId", "externalContactId");

-- CreateIndex
CREATE INDEX "CommunicationChatMessage_tenantId_channelId_createdAt_idx" ON "CommunicationChatMessage"("tenantId", "channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExternalContact" ADD CONSTRAINT "ExternalContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationChatChannel" ADD CONSTRAINT "CommunicationChatChannel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatChannel" ADD CONSTRAINT "CommunicationChatChannel_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatChannel" ADD CONSTRAINT "CommunicationChatChannel_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatChannel" ADD CONSTRAINT "CommunicationChatChannel_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatChannel" ADD CONSTRAINT "CommunicationChatChannel_externalContactId_fkey" FOREIGN KEY ("externalContactId") REFERENCES "ExternalContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationChatMessage" ADD CONSTRAINT "CommunicationChatMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatMessage" ADD CONSTRAINT "CommunicationChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunicationChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChatMessage" ADD CONSTRAINT "CommunicationChatMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
