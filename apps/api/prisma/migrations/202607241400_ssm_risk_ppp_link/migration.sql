-- Link prevention plans to risk assessments (3.8)
ALTER TABLE "SsmPreventionPlan" ADD COLUMN IF NOT EXISTS "riskAssessmentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SsmPreventionPlan_riskAssessmentId_fkey'
  ) THEN
    ALTER TABLE "SsmPreventionPlan"
      ADD CONSTRAINT "SsmPreventionPlan_riskAssessmentId_fkey"
      FOREIGN KEY ("riskAssessmentId") REFERENCES "SsmRiskAssessment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SsmPreventionPlan_tenantId_riskAssessmentId_idx"
  ON "SsmPreventionPlan"("tenantId", "riskAssessmentId");
