-- 3.12 — păstrează doar rolurile SSM; migrează administratorii platformă/tenant la SSM_ADMIN.

UPDATE "User"
SET roles = (
  SELECT COALESCE(
    array_agg(DISTINCT mapped ORDER BY mapped),
    ARRAY[]::"SystemRole"[]
  )
  FROM (
    SELECT CASE
      WHEN r::text IN ('PLATFORM_ADMIN', 'TENANT_ADMIN') THEN 'SSM_ADMIN'::"SystemRole"
      ELSE r
    END AS mapped
    FROM unnest(roles) AS r
  ) sub
);

UPDATE "UserScopedRole"
SET role = 'SSM_ADMIN'::"SystemRole"
WHERE role::text IN ('PLATFORM_ADMIN', 'TENANT_ADMIN');

CREATE TYPE "SystemRole_new" AS ENUM (
  'SSM_ADMIN',
  'SSM_ENTITY_RESPONSIBLE',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE'
);

ALTER TABLE "User" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "roles" TYPE "SystemRole_new"[]
  USING (roles::text[]::"SystemRole_new"[]);
ALTER TABLE "User" ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"SystemRole_new"[];

ALTER TABLE "UserScopedRole"
  ALTER COLUMN "role" TYPE "SystemRole_new"
  USING (role::text::"SystemRole_new");

DROP TYPE "SystemRole";
ALTER TYPE "SystemRole_new" RENAME TO "SystemRole";
