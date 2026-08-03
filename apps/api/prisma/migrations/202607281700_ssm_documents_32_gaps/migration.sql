-- AlterTable
ALTER TABLE "SsmDocumentTemplate" ADD COLUMN "fileName" TEXT;
ALTER TABLE "SsmDocumentTemplate" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "SsmDocumentTemplate" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "SsmDocumentTemplate" ADD COLUMN "storagePath" TEXT;

-- CreateTable
CREATE TABLE "SsmDocumentTypePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentType" "SsmDocumentType" NOT NULL,
    "viewRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approveRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedModuleHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsmDocumentTypePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SsmDocumentTypePolicy_tenantId_idx" ON "SsmDocumentTypePolicy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SsmDocumentTypePolicy_tenantId_documentType_key" ON "SsmDocumentTypePolicy"("tenantId", "documentType");

-- AddForeignKey
ALTER TABLE "SsmDocumentTypePolicy" ADD CONSTRAINT "SsmDocumentTypePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
