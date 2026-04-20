-- Links Electrosales (and any future external datasource) into the Materials
-- catalog and to Quote line items, so approved quotes can auto-log material
-- usage against their projects.

-- 1) Material: external datasource metadata + dedupe index.
ALTER TABLE "Material"
  ADD COLUMN IF NOT EXISTS "externalSource"    TEXT,
  ADD COLUMN IF NOT EXISTS "externalProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalImageUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "externalCategory"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt"      TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Material_companyId_externalSource_externalProductId_key"
  ON "Material" ("companyId", "externalSource", "externalProductId")
  WHERE "externalSource" IS NOT NULL AND "externalProductId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Material_companyId_externalSource_idx"
  ON "Material" ("companyId", "externalSource");

-- 2) QuoteLineItem: optional material link + external snapshot.
ALTER TABLE "QuoteLineItem"
  ADD COLUMN IF NOT EXISTS "materialId"        TEXT,
  ADD COLUMN IF NOT EXISTS "externalSource"    TEXT,
  ADD COLUMN IF NOT EXISTS "externalProductId" TEXT;

-- Foreign key (nullable).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuoteLineItem_materialId_fkey'
  ) THEN
    ALTER TABLE "QuoteLineItem"
      ADD CONSTRAINT "QuoteLineItem_materialId_fkey"
      FOREIGN KEY ("materialId") REFERENCES "Material"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "QuoteLineItem_companyId_materialId_idx"
  ON "QuoteLineItem" ("companyId", "materialId");
