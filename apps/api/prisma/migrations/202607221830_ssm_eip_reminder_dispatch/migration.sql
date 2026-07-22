-- CreateTable
CREATE TABLE "SsmEipReminderDispatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eipMovementId" TEXT NOT NULL,
  "daysUntilDue" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsmEipReminderDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsmEipReminderDispatch_eipMovementId_daysUntilDue_channel_key"
  ON "SsmEipReminderDispatch"("eipMovementId", "daysUntilDue", "channel");
CREATE INDEX "SsmEipReminderDispatch_tenantId_sentAt_idx"
  ON "SsmEipReminderDispatch"("tenantId", "sentAt");

ALTER TABLE "SsmEipReminderDispatch"
ADD CONSTRAINT "SsmEipReminderDispatch_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsmEipReminderDispatch"
ADD CONSTRAINT "SsmEipReminderDispatch_eipMovementId_fkey"
FOREIGN KEY ("eipMovementId") REFERENCES "SsmEipMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
