-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SsmAccidentAttachmentKind" AS ENUM ('PHOTO', 'PV', 'EXPERTISE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Employee medical admission block (operational parity with training blockedAdmission)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "medicalBlockedAdmission" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Employee_tenantId_medicalBlockedAdmission_idx" ON "Employee"("tenantId", "medicalBlockedAdmission");

-- Medical control admission block flag
ALTER TABLE "SsmMedicalControl" ADD COLUMN IF NOT EXISTS "blockedAdmission" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "SsmMedicalControl_tenantId_blockedAdmission_idx" ON "SsmMedicalControl"("tenantId", "blockedAdmission");

UPDATE "SsmMedicalControl"
SET "blockedAdmission" = true
WHERE "result" IN ('UNFIT', 'TEMPORARY_UNFIT');

UPDATE "Employee" e
SET "medicalBlockedAdmission" = EXISTS (
  SELECT 1
  FROM "SsmMedicalControl" c
  WHERE c."tenantId" = e."tenantId"
    AND c."employeeId" = e."id"
    AND c."blockedAdmission" = true
);

-- Accident attachments: table may already exist from compliance_p2; ensure model + kind
CREATE TABLE IF NOT EXISTS "SsmAccidentAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accidentCaseId" TEXT NOT NULL,
    "kind" "SsmAccidentAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "notes" TEXT,
    "retentionArchivedAt" TIMESTAMP(3),
    "filePurgedAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SsmAccidentAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SsmAccidentAttachment" ADD COLUMN IF NOT EXISTS "kind" "SsmAccidentAttachmentKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "SsmAccidentAttachment" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE INDEX IF NOT EXISTS "SsmAccidentAttachment_tenantId_accidentCaseId_idx" ON "SsmAccidentAttachment"("tenantId", "accidentCaseId");
CREATE INDEX IF NOT EXISTS "SsmAccidentAttachment_tenantId_kind_idx" ON "SsmAccidentAttachment"("tenantId", "kind");
CREATE INDEX IF NOT EXISTS "SsmAccidentAttachment_tenantId_retentionArchivedAt_idx" ON "SsmAccidentAttachment"("tenantId", "retentionArchivedAt");

DO $$ BEGIN
  ALTER TABLE "SsmAccidentAttachment" ADD CONSTRAINT "SsmAccidentAttachment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmAccidentAttachment" ADD CONSTRAINT "SsmAccidentAttachment_accidentCaseId_fkey"
    FOREIGN KEY ("accidentCaseId") REFERENCES "SsmAccidentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Self-service password reset tokens
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordResetToken_tenantId_tokenHash_idx" ON "PasswordResetToken"("tenantId", "tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
