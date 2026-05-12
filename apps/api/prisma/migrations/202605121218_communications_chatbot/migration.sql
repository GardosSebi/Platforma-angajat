CREATE TYPE "CommunicationContentType" AS ENUM ('TEXT', 'RICH_TEXT', 'LINK', 'DOCUMENT', 'SURVEY');
CREATE TYPE "CommunicationAudienceType" AS ENUM ('ALL', 'WORKSITE', 'DEPARTMENT', 'JOB_POSITION', 'EMPLOYEE_GROUP', 'EMPLOYEE', 'CUSTOM');
CREATE TYPE "CommunicationAnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'RETRACTED', 'ARCHIVED');

CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentType" "CommunicationContentType" NOT NULL DEFAULT 'TEXT',
    "contentUrl" TEXT,
    "audienceType" "CommunicationAudienceType" NOT NULL DEFAULT 'ALL',
    "audienceRefId" TEXT,
    "audienceLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAnnouncement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentType" "CommunicationContentType" NOT NULL DEFAULT 'TEXT',
    "contentUrl" TEXT,
    "audienceType" "CommunicationAudienceType" NOT NULL,
    "audienceRefId" TEXT,
    "audienceLabel" TEXT,
    "targetEmployeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "CommunicationAnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "lastReminderSentAt" TIMESTAMP(3),
    "templateId" TEXT,
    "duplicatedFromId" TEXT,
    "retractedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAnnouncementRead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationReminderDispatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'CHATBOT',
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "CommunicationReminderDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationTemplate_tenantId_name_key" ON "CommunicationTemplate"("tenantId", "name");
CREATE UNIQUE INDEX "CommunicationAnnouncementRead_announcementId_employeeId_key" ON "CommunicationAnnouncementRead"("announcementId", "employeeId");

CREATE INDEX "CommunicationTemplate_tenantId_active_idx" ON "CommunicationTemplate"("tenantId", "active");
CREATE INDEX "CommunicationAnnouncement_tenantId_status_publishAt_idx" ON "CommunicationAnnouncement"("tenantId", "status", "publishAt");
CREATE INDEX "CommunicationAnnouncement_tenantId_audienceType_audienceRefId_idx" ON "CommunicationAnnouncement"("tenantId", "audienceType", "audienceRefId");
CREATE INDEX "CommunicationAnnouncement_tenantId_createdAt_idx" ON "CommunicationAnnouncement"("tenantId", "createdAt");
CREATE INDEX "CommunicationAnnouncementRead_tenantId_announcementId_readAt_idx" ON "CommunicationAnnouncementRead"("tenantId", "announcementId", "readAt");
CREATE INDEX "CommunicationAnnouncementRead_tenantId_employeeId_readAt_idx" ON "CommunicationAnnouncementRead"("tenantId", "employeeId", "readAt");
CREATE INDEX "CommunicationReminderDispatch_tenantId_scheduledFor_sentAt_idx" ON "CommunicationReminderDispatch"("tenantId", "scheduledFor", "sentAt");
CREATE INDEX "CommunicationReminderDispatch_tenantId_announcementId_idx" ON "CommunicationReminderDispatch"("tenantId", "announcementId");

ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncement" ADD CONSTRAINT "CommunicationAnnouncement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncement" ADD CONSTRAINT "CommunicationAnnouncement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncementRead" ADD CONSTRAINT "CommunicationAnnouncementRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncementRead" ADD CONSTRAINT "CommunicationAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CommunicationAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncementRead" ADD CONSTRAINT "CommunicationAnnouncementRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationReminderDispatch" ADD CONSTRAINT "CommunicationReminderDispatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationReminderDispatch" ADD CONSTRAINT "CommunicationReminderDispatch_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CommunicationAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
