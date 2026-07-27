-- Normalize blank CUI values so optional uniqueness works (multiple NULL allowed).
UPDATE "LegalEntity"
SET "cui" = NULL
WHERE "cui" IS NOT NULL AND btrim("cui") = '';

-- Keep the first entity when duplicate CUI exists for the same tenant.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", upper(btrim("cui"))
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "LegalEntity"
  WHERE "cui" IS NOT NULL
)
UPDATE "LegalEntity" le
SET "cui" = NULL
FROM ranked
WHERE le."id" = ranked."id"
  AND ranked.rn > 1;

UPDATE "LegalEntity"
SET "cui" = upper(btrim("cui"))
WHERE "cui" IS NOT NULL;

CREATE UNIQUE INDEX "LegalEntity_tenantId_cui_key" ON "LegalEntity"("tenantId", "cui");
