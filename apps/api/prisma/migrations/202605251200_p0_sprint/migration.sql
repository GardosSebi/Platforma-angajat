-- P0 sprint: in-app notifications, accident legal fields, document retention archive flag

CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkPath" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InAppNotification_tenantId_userId_readAt_createdAt_idx"
ON "InAppNotification"("tenantId", "userId", "readAt", "createdAt");

CREATE INDEX "InAppNotification_tenantId_userId_createdAt_idx"
ON "InAppNotification"("tenantId", "userId", "createdAt");

ALTER TABLE "InAppNotification"
ADD CONSTRAINT "InAppNotification_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InAppNotification"
ADD CONSTRAINT "InAppNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmAccidentCase"
ADD COLUMN "witnesses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "itmDaysOff" INTEGER,
ADD COLUMN "hasPermanentDisability" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isFatality" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SsmDocumentVersion"
ADD COLUMN "retentionArchivedAt" TIMESTAMP(3);

CREATE INDEX "SsmDocumentVersion_tenantId_retentionArchivedAt_idx"
ON "SsmDocumentVersion"("tenantId", "retentionArchivedAt");
