-- Instructor pe instruirea individuală (Anexa 11) + modul CSSM

ALTER TABLE "SsmTrainingPlan" ADD COLUMN IF NOT EXISTS "trainerEmployeeId" TEXT;
ALTER TABLE "SsmTrainingPlan" ADD COLUMN IF NOT EXISTS "trainerName" TEXT;
ALTER TABLE "SsmTrainingPlan" ADD COLUMN IF NOT EXISTS "trainerFunction" TEXT;

CREATE INDEX IF NOT EXISTS "SsmTrainingPlan_tenantId_trainerEmployeeId_idx"
  ON "SsmTrainingPlan"("tenantId", "trainerEmployeeId");

DO $$ BEGIN
  ALTER TABLE "SsmTrainingPlan"
    ADD CONSTRAINT "SsmTrainingPlan_trainerEmployeeId_fkey"
    FOREIGN KEY ("trainerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmCssmMemberRole" AS ENUM (
    'PRESIDENT',
    'SECRETARY',
    'EMPLOYER_REPRESENTATIVE',
    'EMPLOYEE_REPRESENTATIVE',
    'OCCUPATIONAL_PHYSICIAN',
    'DESIGNATED_WORKER',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmCssmMeetingKind" AS ENUM ('ORDINARY', 'EXTRAORDINARY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SsmCssmMeetingStatus" AS ENUM ('DRAFT', 'CONVENED', 'HELD', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SsmCssmCommittee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decisionNumber" TEXT,
    "decisionDate" TIMESTAMP(3),
    "constitutedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmCssmCommittee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmCssmMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "SsmCssmMemberRole" NOT NULL,
    "functionTitle" TEXT,
    "appointedAt" TIMESTAMP(3),
    "termEndsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmCssmMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmCssmMeeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "kind" "SsmCssmMeetingKind" NOT NULL DEFAULT 'ORDINARY',
    "status" "SsmCssmMeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "agenda" TEXT,
    "convenedAt" TIMESTAMP(3),
    "convenedBy" TEXT,
    "heldAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmCssmMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmCssmMeetingAttendee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "SsmCssmMemberRole",
    "present" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmCssmMeetingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmCssmMinutes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "topics" TEXT,
    "decisions" TEXT,
    "nextMeetingAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmCssmMinutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SsmCssmMinutes_meetingId_key" ON "SsmCssmMinutes"("meetingId");
CREATE UNIQUE INDEX IF NOT EXISTS "SsmCssmMeetingAttendee_meetingId_memberId_key" ON "SsmCssmMeetingAttendee"("meetingId", "memberId");

CREATE INDEX IF NOT EXISTS "SsmCssmCommittee_tenantId_legalEntityId_idx" ON "SsmCssmCommittee"("tenantId", "legalEntityId");
CREATE INDEX IF NOT EXISTS "SsmCssmCommittee_tenantId_active_idx" ON "SsmCssmCommittee"("tenantId", "active");
CREATE INDEX IF NOT EXISTS "SsmCssmMember_tenantId_committeeId_active_idx" ON "SsmCssmMember"("tenantId", "committeeId", "active");
CREATE INDEX IF NOT EXISTS "SsmCssmMember_tenantId_employeeId_idx" ON "SsmCssmMember"("tenantId", "employeeId");
CREATE INDEX IF NOT EXISTS "SsmCssmMeeting_tenantId_committeeId_scheduledAt_idx" ON "SsmCssmMeeting"("tenantId", "committeeId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "SsmCssmMeeting_tenantId_status_scheduledAt_idx" ON "SsmCssmMeeting"("tenantId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "SsmCssmMeetingAttendee_tenantId_meetingId_idx" ON "SsmCssmMeetingAttendee"("tenantId", "meetingId");
CREATE INDEX IF NOT EXISTS "SsmCssmMinutes_tenantId_number_idx" ON "SsmCssmMinutes"("tenantId", "number");

DO $$ BEGIN
  ALTER TABLE "SsmCssmCommittee" ADD CONSTRAINT "SsmCssmCommittee_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmCommittee" ADD CONSTRAINT "SsmCssmCommittee_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMember" ADD CONSTRAINT "SsmCssmMember_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMember" ADD CONSTRAINT "SsmCssmMember_committeeId_fkey"
    FOREIGN KEY ("committeeId") REFERENCES "SsmCssmCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMember" ADD CONSTRAINT "SsmCssmMember_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeeting" ADD CONSTRAINT "SsmCssmMeeting_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeeting" ADD CONSTRAINT "SsmCssmMeeting_committeeId_fkey"
    FOREIGN KEY ("committeeId") REFERENCES "SsmCssmCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeetingAttendee" ADD CONSTRAINT "SsmCssmMeetingAttendee_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeetingAttendee" ADD CONSTRAINT "SsmCssmMeetingAttendee_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "SsmCssmMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeetingAttendee" ADD CONSTRAINT "SsmCssmMeetingAttendee_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "SsmCssmMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMeetingAttendee" ADD CONSTRAINT "SsmCssmMeetingAttendee_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMinutes" ADD CONSTRAINT "SsmCssmMinutes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SsmCssmMinutes" ADD CONSTRAINT "SsmCssmMinutes_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "SsmCssmMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
