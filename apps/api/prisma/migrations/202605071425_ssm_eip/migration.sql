-- CreateEnum
CREATE TYPE "SsmEipMovementType" AS ENUM ('DISTRIBUTION', 'RETURN', 'SCRAP');

-- CreateTable
CREATE TABLE "SsmEipType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "defaultLifetimeDays" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmEipType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmEipNorm" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jobPositionId" TEXT NOT NULL,
  "eipTypeId" TEXT NOT NULL,
  "requiredQuantity" INTEGER NOT NULL,
  "lifetimeDays" INTEGER NOT NULL,
  "replacementRule" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmEipNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmEipStock" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eipTypeId" TEXT NOT NULL,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "minimumThreshold" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsmEipStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsmEipMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eipTypeId" TEXT NOT NULL,
  "movementType" "SsmEipMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replacementDueAt" TIMESTAMP(3),
  "signatureData" TEXT,
  "signedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmEipMovement_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "SsmEipType_tenantId_code_key" ON "SsmEipType"("tenantId", "code");
CREATE INDEX "SsmEipType_tenantId_active_idx" ON "SsmEipType"("tenantId", "active");
CREATE UNIQUE INDEX "SsmEipNorm_jobPositionId_eipTypeId_key" ON "SsmEipNorm"("jobPositionId", "eipTypeId");
CREATE INDEX "SsmEipNorm_tenantId_jobPositionId_idx" ON "SsmEipNorm"("tenantId", "jobPositionId");
CREATE UNIQUE INDEX "SsmEipStock_tenantId_eipTypeId_key" ON "SsmEipStock"("tenantId", "eipTypeId");
CREATE INDEX "SsmEipStock_tenantId_quantityOnHand_idx" ON "SsmEipStock"("tenantId", "quantityOnHand");
CREATE INDEX "SsmEipMovement_tenantId_employeeId_movementDate_idx" ON "SsmEipMovement"("tenantId", "employeeId", "movementDate");
CREATE INDEX "SsmEipMovement_tenantId_replacementDueAt_idx" ON "SsmEipMovement"("tenantId", "replacementDueAt");
CREATE INDEX "SsmEipMovement_tenantId_movementType_idx" ON "SsmEipMovement"("tenantId", "movementType");

-- Foreign keys
ALTER TABLE "SsmEipType"
ADD CONSTRAINT "SsmEipType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmEipNorm"
ADD CONSTRAINT "SsmEipNorm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEipNorm"
ADD CONSTRAINT "SsmEipNorm_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEipNorm"
ADD CONSTRAINT "SsmEipNorm_eipTypeId_fkey" FOREIGN KEY ("eipTypeId") REFERENCES "SsmEipType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmEipStock"
ADD CONSTRAINT "SsmEipStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEipStock"
ADD CONSTRAINT "SsmEipStock_eipTypeId_fkey" FOREIGN KEY ("eipTypeId") REFERENCES "SsmEipType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmEipMovement"
ADD CONSTRAINT "SsmEipMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEipMovement"
ADD CONSTRAINT "SsmEipMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsmEipMovement"
ADD CONSTRAINT "SsmEipMovement_eipTypeId_fkey" FOREIGN KEY ("eipTypeId") REFERENCES "SsmEipType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
