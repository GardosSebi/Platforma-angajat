-- CreateEnum
CREATE TYPE "SsmResponsibleType" AS ENUM ('DESIGNATED_WORKER', 'EXTERNAL_SERVICE');

-- CreateTable Worksite
CREATE TABLE "Worksite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worksite_pkey" PRIMARY KEY ("id")
);

-- CreateTable Department
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable JobPosition
CREATE TABLE "JobPosition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "corCode" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN     "cnp" TEXT,
ADD COLUMN "hireDate" TIMESTAMP(3),
ADD COLUMN "leaveDate" TIMESTAMP(3),
ADD COLUMN "worksiteId" TEXT,
ADD COLUMN "departmentId" TEXT,
ADD COLUMN "jobPositionId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable EmployeePlacementHistory
CREATE TABLE "EmployeePlacementHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "worksiteId" TEXT,
    "departmentId" TEXT,
    "jobPositionId" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "EmployeePlacementHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmployeeGroup
CREATE TABLE "EmployeeGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmployeeGroupMember
CREATE TABLE "EmployeeGroupMember" (
    "groupId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeGroupMember_pkey" PRIMARY KEY ("groupId","employeeId")
);

-- CreateTable SsmResponsible
CREATE TABLE "SsmResponsible" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worksiteId" TEXT,
    "type" "SsmResponsibleType" NOT NULL,
    "personName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsmResponsible_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Worksite
CREATE UNIQUE INDEX "Worksite_tenantId_code_key" ON "Worksite"("tenantId", "code");
CREATE INDEX "Worksite_tenantId_active_idx" ON "Worksite"("tenantId", "active");

-- CreateIndex Department
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");
CREATE INDEX "Department_tenantId_worksiteId_idx" ON "Department"("tenantId", "worksiteId");

-- CreateIndex JobPosition
CREATE UNIQUE INDEX "JobPosition_tenantId_code_key" ON "JobPosition"("tenantId", "code");
CREATE INDEX "JobPosition_tenantId_departmentId_idx" ON "JobPosition"("tenantId", "departmentId");

-- CreateIndex Employee
CREATE INDEX "Employee_tenantId_worksiteId_idx" ON "Employee"("tenantId", "worksiteId");
CREATE INDEX "Employee_tenantId_departmentId_idx" ON "Employee"("tenantId", "departmentId");

-- CreateIndex EmployeePlacementHistory
CREATE INDEX "EmployeePlacementHistory_tenantId_employeeId_idx" ON "EmployeePlacementHistory"("tenantId", "employeeId");
CREATE INDEX "EmployeePlacementHistory_tenantId_effectiveFrom_idx" ON "EmployeePlacementHistory"("tenantId", "effectiveFrom");

-- CreateIndex EmployeeGroup
CREATE UNIQUE INDEX "EmployeeGroup_tenantId_name_key" ON "EmployeeGroup"("tenantId", "name");
CREATE INDEX "EmployeeGroup_tenantId_active_idx" ON "EmployeeGroup"("tenantId", "active");

-- CreateIndex SsmResponsible
CREATE INDEX "SsmResponsible_tenantId_worksiteId_idx" ON "SsmResponsible"("tenantId", "worksiteId");
CREATE INDEX "SsmResponsible_tenantId_active_idx" ON "SsmResponsible"("tenantId", "active");

-- AddForeignKey Worksite
ALTER TABLE "Worksite" ADD CONSTRAINT "Worksite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Department
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey JobPosition
ALTER TABLE "JobPosition" ADD CONSTRAINT "JobPosition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPosition" ADD CONSTRAINT "JobPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Employee
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey EmployeePlacementHistory
ALTER TABLE "EmployeePlacementHistory" ADD CONSTRAINT "EmployeePlacementHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePlacementHistory" ADD CONSTRAINT "EmployeePlacementHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePlacementHistory" ADD CONSTRAINT "EmployeePlacementHistory_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeePlacementHistory" ADD CONSTRAINT "EmployeePlacementHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeePlacementHistory" ADD CONSTRAINT "EmployeePlacementHistory_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey EmployeeGroup
ALTER TABLE "EmployeeGroup" ADD CONSTRAINT "EmployeeGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey EmployeeGroupMember
ALTER TABLE "EmployeeGroupMember" ADD CONSTRAINT "EmployeeGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeGroupMember" ADD CONSTRAINT "EmployeeGroupMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey SsmResponsible
ALTER TABLE "SsmResponsible" ADD CONSTRAINT "SsmResponsible_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmResponsible" ADD CONSTRAINT "SsmResponsible_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
