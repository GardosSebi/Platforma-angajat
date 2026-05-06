-- Align @updatedAt with Prisma (no DB default) for Part B tables
ALTER TABLE "Worksite" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Department" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "JobPosition" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmployeeGroup" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SsmResponsible" ALTER COLUMN "updatedAt" DROP DEFAULT;
