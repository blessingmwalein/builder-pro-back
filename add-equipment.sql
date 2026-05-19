-- Equipment & Inventory tables
DO $$ BEGIN
  CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE','IN_USE','MAINTENANCE','RETIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "EquipmentCategory" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentCategory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentCategory_companyId_name_key"
  ON "EquipmentCategory"("companyId","name");

CREATE TABLE IF NOT EXISTS "Equipment" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"    TEXT NOT NULL,
  "categoryId"   TEXT,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "serialNumber" TEXT,
  "status"       "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
  "dailyRate"    DECIMAL(10,2),
  "purchaseCost" DECIMAL(18,2),
  "purchasedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Equipment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Equipment_companyId_status_deletedAt_idx"
  ON "Equipment"("companyId","status","deletedAt");
DO $$ BEGIN
  ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "EquipmentAllocation" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"     TEXT NOT NULL,
  "equipmentId"   TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "allocatedById" TEXT NOT NULL,
  "startDate"     TIMESTAMP(3) NOT NULL,
  "endDate"       TIMESTAMP(3),
  "returnedAt"    TIMESTAMP(3),
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentAllocation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentAllocation_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentAllocation_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EquipmentAllocation_allocatedById_fkey"
    FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EquipmentAllocation_companyId_equipmentId_idx"
  ON "EquipmentAllocation"("companyId","equipmentId");
CREATE INDEX IF NOT EXISTS "EquipmentAllocation_companyId_projectId_idx"
  ON "EquipmentAllocation"("companyId","projectId");
