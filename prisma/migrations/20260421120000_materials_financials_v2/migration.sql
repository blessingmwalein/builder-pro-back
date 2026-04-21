-- Materials & Financials v2: MaterialCategory, MaterialPurchase, plus
-- project-closure metadata and receipt fields on transactions / logs.

-- 1) Supplier: categories column
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "categories" TEXT;

-- 2) MaterialCategory
CREATE TABLE IF NOT EXISTS "MaterialCategory" (
  "id"          TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "MaterialCategory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialCategory_companyId_code_key"
  ON "MaterialCategory" ("companyId", "code");
CREATE INDEX IF NOT EXISTS "MaterialCategory_companyId_deletedAt_idx"
  ON "MaterialCategory" ("companyId", "deletedAt");

-- 3) Material: categoryId FK + description
ALTER TABLE "Material"
  ADD COLUMN IF NOT EXISTS "categoryId"  TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Material_categoryId_fkey'
  ) THEN
    ALTER TABLE "Material"
      ADD CONSTRAINT "Material_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Material_companyId_categoryId_idx"
  ON "Material" ("companyId", "categoryId");

-- 4) MaterialPurchase: a bulk purchase with optional receipt, wraps several logs.
CREATE TABLE IF NOT EXISTS "MaterialPurchase" (
  "id"             TEXT PRIMARY KEY,
  "companyId"      TEXT NOT NULL,
  "supplierId"     TEXT,
  "projectId"      TEXT,
  "purchaseNumber" TEXT,
  "purchasedAt"    TIMESTAMP(3) NOT NULL,
  "totalAmount"    DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "receiptKey"     TEXT,
  "receiptUrl"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "deletedAt"      TIMESTAMP(3),
  CONSTRAINT "MaterialPurchase_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialPurchase_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MaterialPurchase_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MaterialPurchase_companyId_purchasedAt_idx"
  ON "MaterialPurchase" ("companyId", "purchasedAt");
CREATE INDEX IF NOT EXISTS "MaterialPurchase_companyId_supplierId_idx"
  ON "MaterialPurchase" ("companyId", "supplierId");

-- 5) MaterialLog: purchaseId FK + receiptUrl + entryType (PURCHASE vs USAGE)
ALTER TABLE "MaterialLog"
  ADD COLUMN IF NOT EXISTS "purchaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "entryType"  TEXT NOT NULL DEFAULT 'USAGE';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialLog_purchaseId_fkey'
  ) THEN
    ALTER TABLE "MaterialLog"
      ADD CONSTRAINT "MaterialLog_purchaseId_fkey"
      FOREIGN KEY ("purchaseId") REFERENCES "MaterialPurchase"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MaterialLog_companyId_purchaseId_idx"
  ON "MaterialLog" ("companyId", "purchaseId");

-- 6) FinancialTransaction: proof-of-purchase attachments
ALTER TABLE "FinancialTransaction"
  ADD COLUMN IF NOT EXISTS "receiptKey" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;

-- 7) Project: closure snapshot
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "closedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closureSummary" JSONB;
