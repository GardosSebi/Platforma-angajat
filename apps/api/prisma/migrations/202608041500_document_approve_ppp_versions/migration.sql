-- Enum value must be committed before it can be used (PostgreSQL 55P04).
-- Keep this migration free of any statements that reference 'APPROVED'.
ALTER TYPE "SsmDocumentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
