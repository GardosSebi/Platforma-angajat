-- Align User.updatedAt with Prisma @updatedAt (no DB default)
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
