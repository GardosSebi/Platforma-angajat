CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "SurveyQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'TEXT', 'LONG_TEXT', 'DATE', 'BOOLEAN');
CREATE TYPE "SurveyAudienceType" AS ENUM ('ALL', 'WORKSITE', 'DEPARTMENT', 'JOB_POSITION', 'EMPLOYEE_GROUP', 'EMPLOYEE', 'CUSTOM');

CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceType" "SurveyAudienceType" NOT NULL DEFAULT 'ALL',
    "audienceRefId" TEXT,
    "audienceLabel" TEXT,
    "targetEmployeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "questionSchema" JSONB NOT NULL,
    "conditionalLogic" JSONB,
    "privateLinkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicToken" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicExpiresAt" TIMESTAMP(3),
    "publicResponseLimit" INTEGER,
    "publicResponseCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "respondentUserId" TEXT,
    "publicToken" TEXT,
    "answersJson" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Survey_publicToken_key" ON "Survey"("publicToken");
CREATE INDEX "Survey_tenantId_status_createdAt_idx" ON "Survey"("tenantId", "status", "createdAt");
CREATE INDEX "Survey_tenantId_audienceType_audienceRefId_idx" ON "Survey"("tenantId", "audienceType", "audienceRefId");
CREATE INDEX "SurveyResponse_tenantId_surveyId_submittedAt_idx" ON "SurveyResponse"("tenantId", "surveyId", "submittedAt");
CREATE INDEX "SurveyResponse_tenantId_employeeId_submittedAt_idx" ON "SurveyResponse"("tenantId", "employeeId", "submittedAt");
CREATE INDEX "SurveyResponse_publicToken_submittedAt_idx" ON "SurveyResponse"("publicToken", "submittedAt");

ALTER TABLE "Survey" ADD CONSTRAINT "Survey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
