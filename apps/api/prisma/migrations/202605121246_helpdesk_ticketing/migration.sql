CREATE TYPE "HelpdeskTicketStatus" AS ENUM ('NEW', 'TRIAGE', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED');
CREATE TYPE "HelpdeskTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "HelpdeskTicketSource" AS ENUM ('PORTAL', 'SURVEY', 'CHATBOT', 'EMAIL', 'MANUAL');

CREATE TABLE "HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "status" "HelpdeskTicketStatus" NOT NULL DEFAULT 'NEW',
    "priority" "HelpdeskTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "source" "HelpdeskTicketSource" NOT NULL DEFAULT 'PORTAL',
    "reporterEmployeeId" TEXT,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "assignedToUserId" TEXT,
    "assignedToName" TEXT,
    "sourceSurveyResponseId" TEXT,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpdeskTicketComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskTicketComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpdeskTicket_tenantId_status_priority_idx" ON "HelpdeskTicket"("tenantId", "status", "priority");
CREATE INDEX "HelpdeskTicket_tenantId_assignedToUserId_status_idx" ON "HelpdeskTicket"("tenantId", "assignedToUserId", "status");
CREATE INDEX "HelpdeskTicket_tenantId_reporterEmployeeId_createdAt_idx" ON "HelpdeskTicket"("tenantId", "reporterEmployeeId", "createdAt");
CREATE INDEX "HelpdeskTicket_tenantId_source_createdAt_idx" ON "HelpdeskTicket"("tenantId", "source", "createdAt");
CREATE INDEX "HelpdeskTicketComment_tenantId_ticketId_createdAt_idx" ON "HelpdeskTicketComment"("tenantId", "ticketId", "createdAt");

ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_reporterEmployeeId_fkey" FOREIGN KEY ("reporterEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_sourceSurveyResponseId_fkey" FOREIGN KEY ("sourceSurveyResponseId") REFERENCES "SurveyResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpdeskTicketComment" ADD CONSTRAINT "HelpdeskTicketComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpdeskTicketComment" ADD CONSTRAINT "HelpdeskTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
