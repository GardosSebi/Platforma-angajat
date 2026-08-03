-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunicationAnnouncementAnswer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationAnnouncementAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationAnnouncementAnswer_tenantId_announcementId_createdAt_idx"
  ON "CommunicationAnnouncementAnswer"("tenantId", "announcementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationAnnouncementAnswer_announcementId_employeeId_key"
  ON "CommunicationAnnouncementAnswer"("announcementId", "employeeId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommunicationAnnouncementAnswer"
    ADD CONSTRAINT "CommunicationAnnouncementAnswer_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunicationAnnouncementAnswer"
    ADD CONSTRAINT "CommunicationAnnouncementAnswer_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "CommunicationAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunicationAnnouncementAnswer"
    ADD CONSTRAINT "CommunicationAnnouncementAnswer_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
