-- Production drift: Prisma client expects these MapCompany columns. Add if missing (idempotent).
-- Run on Supabase: SQL Editor → paste → run, or: npx prisma migrate deploy

ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "enrichmentSubstatus" TEXT;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "enrichmentError" TEXT;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "apolloOrgId" TEXT;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "techStackVerified" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "techStackSources" JSONB;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "stackConfidence" JSONB;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "jdCount" INTEGER;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "stackScanStatus" TEXT;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "departmentalHeadcount" JSONB;
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "lastStackScanAt" TIMESTAMP(3);
