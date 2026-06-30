-- Chatbot module full feature set (4.1–4.6)

ALTER TYPE "CommunicationContentType" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "CommunicationContentType" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "CommunicationContentType" ADD VALUE IF NOT EXISTS 'SLIDE';
ALTER TYPE "CommunicationContentType" ADD VALUE IF NOT EXISTS 'BUTTON';

CREATE TYPE "CommunicationMessageType" AS ENUM ('ANNOUNCEMENT', 'QUESTION', 'READ_CONFIRMATION');

ALTER TYPE "CommunicationAnnouncementStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SEND';

ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'DROPDOWN';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'MULTI_DROPDOWN';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'MULTI_TEXT';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'RANKING';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'FILE_UPLOAD';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'IMAGE_SELECT';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_tenantId_lastLoginAt_idx" ON "User"("tenantId", "lastLoginAt");

ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "messageType" "CommunicationMessageType" NOT NULL DEFAULT 'ANNOUNCEMENT';
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "requireReadConfirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "linkedSurveyId" TEXT;
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "buttonLabel" TEXT;
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "buttonUrl" TEXT;
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "translations" JSONB;
ALTER TABLE "CommunicationAnnouncement" ADD COLUMN IF NOT EXISTS "reactionsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "anonymousMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "emailNotifyOnPublish" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "autoCreateTicket" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "autoTicketTitle" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "autoTicketCategory" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "translations" JSONB;

CREATE TABLE IF NOT EXISTS "CommunicationAnnouncementReaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationAnnouncementReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationAnnouncementReaction_announcementId_employeeId_key"
  ON "CommunicationAnnouncementReaction"("announcementId", "employeeId");
CREATE INDEX IF NOT EXISTS "CommunicationAnnouncementReaction_tenantId_announcementId_idx"
  ON "CommunicationAnnouncementReaction"("tenantId", "announcementId");

ALTER TABLE "CommunicationAnnouncementReaction" DROP CONSTRAINT IF EXISTS "CommunicationAnnouncementReaction_tenantId_fkey";
ALTER TABLE "CommunicationAnnouncementReaction" ADD CONSTRAINT "CommunicationAnnouncementReaction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncementReaction" DROP CONSTRAINT IF EXISTS "CommunicationAnnouncementReaction_announcementId_fkey";
ALTER TABLE "CommunicationAnnouncementReaction" ADD CONSTRAINT "CommunicationAnnouncementReaction_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "CommunicationAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAnnouncementReaction" DROP CONSTRAINT IF EXISTS "CommunicationAnnouncementReaction_employeeId_fkey";
ALTER TABLE "CommunicationAnnouncementReaction" ADD CONSTRAINT "CommunicationAnnouncementReaction_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
