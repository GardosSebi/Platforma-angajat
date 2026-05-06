-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM (
  'PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'SSM_ADMIN',
  'SSM_ENTITY_RESPONSIBLE',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE'
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roles" "SystemRole"[] DEFAULT ARRAY[]::"SystemRole"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "User_tenantId_active_idx" ON "User"("tenantId", "active");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
