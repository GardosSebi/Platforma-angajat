-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_tenantId_authProvider_externalId_idx" ON "User"("tenantId", "authProvider", "externalId");

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CommunicationPublishScope" AS ENUM ('ALL', 'LEGAL_ENTITY', 'EMPLOYEE_GROUP', 'WORKSITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SsmReportCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SsmReportDeliveryFormat" AS ENUM ('PDF', 'XLSX', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunicationPublishRight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" "CommunicationPublishScope" NOT NULL,
    "legalEntityId" TEXT,
    "employeeGroupId" TEXT,
    "worksiteId" TEXT,
    "canPublish" BOOLEAN NOT NULL DEFAULT true,
    "canManageTemplates" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunicationPublishRight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SsmScheduledReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "cadence" "SsmReportCadence" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "recipients" TEXT[],
    "format" "SsmReportDeliveryFormat" NOT NULL DEFAULT 'PDF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SsmScheduledReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantSsoConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "azureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "azureTenantId" TEXT,
    "azureClientId" TEXT,
    "azureClientSecret" TEXT,
    "azureRedirectUri" TEXT,
    "ldapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ldapUrl" TEXT,
    "ldapBaseDn" TEXT,
    "ldapBindDn" TEXT,
    "ldapBindPassword" TEXT,
    "ldapSearchFilter" TEXT DEFAULT '(mail={{username}})',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantSsoConfig_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CommunicationPublishRight_tenantId_userId_idx" ON "CommunicationPublishRight"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "CommunicationPublishRight_tenantId_scopeType_idx" ON "CommunicationPublishRight"("tenantId", "scopeType");
CREATE INDEX IF NOT EXISTS "CommunicationPublishRight_tenantId_legalEntityId_idx" ON "CommunicationPublishRight"("tenantId", "legalEntityId");
CREATE INDEX IF NOT EXISTS "CommunicationPublishRight_tenantId_employeeGroupId_idx" ON "CommunicationPublishRight"("tenantId", "employeeGroupId");
CREATE INDEX IF NOT EXISTS "CommunicationPublishRight_tenantId_worksiteId_idx" ON "CommunicationPublishRight"("tenantId", "worksiteId");

CREATE INDEX IF NOT EXISTS "SsmScheduledReport_tenantId_active_nextRunAt_idx" ON "SsmScheduledReport"("tenantId", "active", "nextRunAt");
CREATE INDEX IF NOT EXISTS "SsmScheduledReport_tenantId_reportType_idx" ON "SsmScheduledReport"("tenantId", "reportType");

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_tenantId_endpoint_key" ON "PushSubscription"("tenantId", "endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSsoConfig_tenantId_key" ON "TenantSsoConfig"("tenantId");

-- ForeignKeys
DO $$ BEGIN
  ALTER TABLE "CommunicationPublishRight" ADD CONSTRAINT "CommunicationPublishRight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunicationPublishRight" ADD CONSTRAINT "CommunicationPublishRight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunicationPublishRight" ADD CONSTRAINT "CommunicationPublishRight_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunicationPublishRight" ADD CONSTRAINT "CommunicationPublishRight_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunicationPublishRight" ADD CONSTRAINT "CommunicationPublishRight_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SsmScheduledReport" ADD CONSTRAINT "SsmScheduledReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantSsoConfig" ADD CONSTRAINT "TenantSsoConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
