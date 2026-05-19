-- Enums for procurement
DO $$ BEGIN
  CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','ORDERED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','SENT','PARTIAL','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PurchaseRequest
CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"     TEXT NOT NULL,
  "projectId"     TEXT,
  "requestedById" TEXT NOT NULL,
  "prNumber"      TEXT NOT NULL,
  "status"        "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"         TEXT,
  "approvedById"  TEXT,
  "approvedAt"    TIMESTAMP(3),
  "rejectedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"     TIMESTAMP(3),
  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequest_companyId_prNumber_key" ON "PurchaseRequest"("companyId","prNumber");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_companyId_status_deletedAt_idx" ON "PurchaseRequest"("companyId","status","deletedAt");
ALTER TABLE "PurchaseRequest" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
DO $$ BEGIN
  ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PurchaseRequestItem
CREATE TABLE IF NOT EXISTS "PurchaseRequestItem" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
  "purchaseRequestId" TEXT NOT NULL,
  "materialId"        TEXT,
  "description"       TEXT NOT NULL,
  "quantity"          DECIMAL(14,3) NOT NULL,
  "unit"              TEXT NOT NULL,
  "estimatedUnitCost" DECIMAL(12,2),
  CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey"
    FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PurchaseRequestItem_purchaseRequestId_idx" ON "PurchaseRequestItem"("purchaseRequestId");
DO $$ BEGIN
  ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PurchaseOrder
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"         TEXT NOT NULL,
  "purchaseRequestId" TEXT,
  "supplierId"        TEXT NOT NULL,
  "poNumber"          TEXT NOT NULL,
  "status"            "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "totalAmount"       DECIMAL(18,2) NOT NULL DEFAULT 0,
  "expectedDelivery"  TIMESTAMP(3),
  "deliveredAt"       TIMESTAMP(3),
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"         TIMESTAMP(3),
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrder_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_companyId_poNumber_key" ON "PurchaseOrder"("companyId","poNumber");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_companyId_status_deletedAt_idx" ON "PurchaseOrder"("companyId","status","deletedAt");
DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey"
    FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PurchaseOrderItem
CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
  "purchaseOrderId" TEXT NOT NULL,
  "materialId"      TEXT,
  "description"     TEXT NOT NULL,
  "quantity"        DECIMAL(14,3) NOT NULL,
  "unitCost"        DECIMAL(12,2) NOT NULL,
  "totalCost"       DECIMAL(18,2) NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- DeliveryNote
CREATE TABLE IF NOT EXISTS "DeliveryNote" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"       TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "deliveryDate"    TIMESTAMP(3) NOT NULL,
  "notes"           TEXT,
  "receivedById"    TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryNote_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryNote_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryNote_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryNote_companyId_purchaseOrderId_idx" ON "DeliveryNote"("companyId","purchaseOrderId");

-- DeliveryNoteItem
CREATE TABLE IF NOT EXISTS "DeliveryNoteItem" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
  "deliveryNoteId"   TEXT NOT NULL,
  "materialId"       TEXT,
  "description"      TEXT NOT NULL,
  "quantityOrdered"  DECIMAL(14,3) NOT NULL,
  "quantityReceived" DECIMAL(14,3) NOT NULL,
  CONSTRAINT "DeliveryNoteItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryNoteItem_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_deliveryNoteId_idx" ON "DeliveryNoteItem"("deliveryNoteId");
DO $$ BEGIN
  ALTER TABLE "DeliveryNoteItem" ADD CONSTRAINT "DeliveryNoteItem_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
