-- Gate visits, ITM inspection visits, EIP extras, medical appointment requests

DO $$ BEGIN
  CREATE TYPE "SsmGateVisitStatus" AS ENUM ('REGISTERED', 'BRIEFING', 'SIGNED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmGateVisitorKind" AS ENUM ('VISITOR', 'DETACHED', 'TEMPORARY', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmEipOrderStatus" AS ENUM ('NEEDED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmMedicalAppointmentStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ItmInspectionVisitStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ItmInspectionVisit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "inspectorUserId" TEXT NOT NULL,
    "inspectorName" TEXT,
    "status" "ItmInspectionVisitStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItmInspectionVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmGateVisit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "companyName" TEXT,
    "purpose" TEXT,
    "trainerName" TEXT,
    "trainerFunction" TEXT,
    "trainerSignature" TEXT,
    "location" TEXT,
    "briefingTitle" TEXT NOT NULL,
    "briefingNotes" TEXT,
    "status" "SsmGateVisitStatus" NOT NULL DEFAULT 'REGISTERED',
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmGateVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmGateVisitAttendee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "company" TEXT,
    "idDocument" TEXT,
    "visitorKind" "SsmGateVisitorKind" NOT NULL DEFAULT 'VISITOR',
    "trainingAcknowledgedAt" TIMESTAMP(3),
    "signatureData" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmGateVisitAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmEipOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eipTypeId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "neededQuantity" INTEGER NOT NULL,
    "orderedQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "SsmEipOrderStatus" NOT NULL DEFAULT 'NEEDED',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmEipOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmEipRegisterSignoff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "signedByUserId" TEXT NOT NULL,
    "signedByName" TEXT,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),

    CONSTRAINT "SsmEipRegisterSignoff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmMedicalAppointmentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "SsmMedicalAppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledControlId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmMedicalAppointmentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "photoPath" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "photoName" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "photoMime" TEXT;
ALTER TABLE "SsmEipMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE INDEX IF NOT EXISTS "ItmInspectionVisit_tenantId_startedAt_idx" ON "ItmInspectionVisit"("tenantId", "startedAt");
CREATE INDEX IF NOT EXISTS "ItmInspectionVisit_tenantId_worksiteId_startedAt_idx" ON "ItmInspectionVisit"("tenantId", "worksiteId", "startedAt");
CREATE INDEX IF NOT EXISTS "ItmInspectionVisit_tenantId_inspectorUserId_idx" ON "ItmInspectionVisit"("tenantId", "inspectorUserId");

CREATE INDEX IF NOT EXISTS "SsmGateVisit_tenantId_visitDate_idx" ON "SsmGateVisit"("tenantId", "visitDate");
CREATE INDEX IF NOT EXISTS "SsmGateVisit_tenantId_status_visitDate_idx" ON "SsmGateVisit"("tenantId", "status", "visitDate");
CREATE INDEX IF NOT EXISTS "SsmGateVisit_tenantId_worksiteId_idx" ON "SsmGateVisit"("tenantId", "worksiteId");

CREATE INDEX IF NOT EXISTS "SsmGateVisitAttendee_tenantId_visitId_idx" ON "SsmGateVisitAttendee"("tenantId", "visitId");
CREATE INDEX IF NOT EXISTS "SsmGateVisitAttendee_tenantId_employeeId_idx" ON "SsmGateVisitAttendee"("tenantId", "employeeId");

CREATE INDEX IF NOT EXISTS "SsmEipOrder_tenantId_status_idx" ON "SsmEipOrder"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "SsmEipOrder_tenantId_eipTypeId_idx" ON "SsmEipOrder"("tenantId", "eipTypeId");
CREATE INDEX IF NOT EXISTS "SsmEipOrder_tenantId_worksiteId_idx" ON "SsmEipOrder"("tenantId", "worksiteId");

CREATE INDEX IF NOT EXISTS "SsmEipRegisterSignoff_tenantId_signedAt_idx" ON "SsmEipRegisterSignoff"("tenantId", "signedAt");

CREATE INDEX IF NOT EXISTS "SsmMedicalAppointmentRequest_tenantId_employeeId_createdAt_idx" ON "SsmMedicalAppointmentRequest"("tenantId", "employeeId", "createdAt");
CREATE INDEX IF NOT EXISTS "SsmMedicalAppointmentRequest_tenantId_status_idx" ON "SsmMedicalAppointmentRequest"("tenantId", "status");

DO $$ BEGIN
  ALTER TABLE "ItmInspectionVisit" ADD CONSTRAINT "ItmInspectionVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ItmInspectionVisit" ADD CONSTRAINT "ItmInspectionVisit_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ItmInspectionVisit" ADD CONSTRAINT "ItmInspectionVisit_inspectorUserId_fkey" FOREIGN KEY ("inspectorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmGateVisit" ADD CONSTRAINT "SsmGateVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmGateVisit" ADD CONSTRAINT "SsmGateVisit_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmGateVisitAttendee" ADD CONSTRAINT "SsmGateVisitAttendee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmGateVisitAttendee" ADD CONSTRAINT "SsmGateVisitAttendee_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SsmGateVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmGateVisitAttendee" ADD CONSTRAINT "SsmGateVisitAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmEipOrder" ADD CONSTRAINT "SsmEipOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmEipOrder" ADD CONSTRAINT "SsmEipOrder_eipTypeId_fkey" FOREIGN KEY ("eipTypeId") REFERENCES "SsmEipType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmEipOrder" ADD CONSTRAINT "SsmEipOrder_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmEipRegisterSignoff" ADD CONSTRAINT "SsmEipRegisterSignoff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmEipRegisterSignoff" ADD CONSTRAINT "SsmEipRegisterSignoff_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmMedicalAppointmentRequest" ADD CONSTRAINT "SsmMedicalAppointmentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmMedicalAppointmentRequest" ADD CONSTRAINT "SsmMedicalAppointmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SsmMedicalAppointmentRequest" ADD CONSTRAINT "SsmMedicalAppointmentRequest_scheduledControlId_fkey" FOREIGN KEY ("scheduledControlId") REFERENCES "SsmMedicalControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmEipMovement" ADD CONSTRAINT "SsmEipMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SsmEipOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
