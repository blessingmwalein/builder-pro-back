-- Approvals engine tables
DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"     TEXT NOT NULL,
  "entityType"    TEXT NOT NULL,
  "entityId"      TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status"        "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ApprovalRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ApprovalRequest_companyId_entityType_status_idx"
  ON "ApprovalRequest"("companyId","entityType","status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_companyId_entityId_idx"
  ON "ApprovalRequest"("companyId","entityId");

CREATE TABLE IF NOT EXISTS "ApprovalStep" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
  "approvalRequestId" TEXT NOT NULL,
  "stepOrder"         INTEGER NOT NULL,
  "approverId"        TEXT NOT NULL,
  "status"            "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "comment"           TEXT,
  "decidedAt"         TIMESTAMP(3),
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalStep_approvalRequestId_fkey"
    FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ApprovalStep_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ApprovalStep_approvalRequestId_idx"
  ON "ApprovalStep"("approvalRequestId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_approverId_status_idx"
  ON "ApprovalStep"("approverId","status");
