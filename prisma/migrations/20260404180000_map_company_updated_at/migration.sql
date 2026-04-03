-- Track last write for stale enrichment lock recovery (GET map unlocks stuck "enriching" rows).
ALTER TABLE "MapCompany" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
