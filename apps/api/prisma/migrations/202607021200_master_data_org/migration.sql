-- Master Data §3.1: post de lucru legat direct de punct de lucru

ALTER TABLE "JobPosition" ADD COLUMN IF NOT EXISTS "worksiteId" TEXT;
CREATE INDEX IF NOT EXISTS "JobPosition_tenantId_worksiteId_idx" ON "JobPosition"("tenantId", "worksiteId");
ALTER TABLE "JobPosition"
ADD CONSTRAINT "JobPosition_worksiteId_fkey"
FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
