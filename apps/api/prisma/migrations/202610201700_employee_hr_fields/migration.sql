-- Employee HR fields present in schema but missing from prior migrations.
-- Idempotent so environments that already received a manual/db-push apply stay safe.

DO $$ BEGIN
  CREATE TYPE "EmployeeMaritalStatus" AS ENUM (
    'UNMARRIED',
    'MARRIED',
    'DIVORCED',
    'WIDOWED',
    'CONSENSUAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "domicile" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "commuteRoute" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "iscirAuthorizations" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" "EmployeeMaritalStatus";
