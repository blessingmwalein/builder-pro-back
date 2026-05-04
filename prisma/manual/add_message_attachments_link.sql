ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "messageId" text;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_messageId_fkey"
  FOREIGN KEY ("messageId")
  REFERENCES "Message"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Document_companyId_messageId_deletedAt_idx"
  ON "Document"("companyId", "messageId", "deletedAt");
