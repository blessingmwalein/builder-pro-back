ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "stageId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "stageId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Task_companyId_projectId_stageId_idx" ON "Task"("companyId", "projectId", "stageId");
CREATE INDEX IF NOT EXISTS "Document_companyId_projectId_stageId_deletedAt_idx" ON "Document"("companyId", "projectId", "stageId", "deletedAt");
