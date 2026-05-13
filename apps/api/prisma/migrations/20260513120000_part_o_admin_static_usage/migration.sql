-- Part O: admin scoped roles, employee static pages, usage reporting support

CREATE TYPE "RoleAssignmentScope" AS ENUM ('WORKSITE', 'EMPLOYEE_GROUP');

CREATE TYPE "EmployeeStaticAudienceType" AS ENUM ('ALL', 'WORKSITE', 'EMPLOYEE_GROUP');

CREATE TABLE "UserScopedRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "scope" "RoleAssignmentScope" NOT NULL,
    "worksiteId" TEXT,
    "employeeGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "UserScopedRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeStaticPage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "audienceType" "EmployeeStaticAudienceType" NOT NULL DEFAULT 'ALL',
    "audienceRefId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "attachmentName" TEXT,
    "attachmentPath" TEXT,
    "attachmentMime" TEXT,
    "attachmentSize" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeStaticPage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserScopedRole_tenantId_userId_idx" ON "UserScopedRole"("tenantId", "userId");

CREATE INDEX "UserScopedRole_tenantId_worksiteId_idx" ON "UserScopedRole"("tenantId", "worksiteId");

CREATE INDEX "UserScopedRole_tenantId_employeeGroupId_idx" ON "UserScopedRole"("tenantId", "employeeGroupId");

CREATE UNIQUE INDEX "EmployeeStaticPage_tenantId_slug_key" ON "EmployeeStaticPage"("tenantId", "slug");

CREATE INDEX "EmployeeStaticPage_tenantId_published_sortOrder_idx" ON "EmployeeStaticPage"("tenantId", "published", "sortOrder");

ALTER TABLE "UserScopedRole" ADD CONSTRAINT "UserScopedRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserScopedRole" ADD CONSTRAINT "UserScopedRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserScopedRole" ADD CONSTRAINT "UserScopedRole_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserScopedRole" ADD CONSTRAINT "UserScopedRole_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeStaticPage" ADD CONSTRAINT "EmployeeStaticPage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
