/*
  Warnings:

  - The `employmentType` column on the `Employee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[inviteToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'RENOVATION', 'INFRASTRUCTURE', 'INDUSTRIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VariationType" AS ENUM ('ADDITION', 'OMISSION', 'SUBSTITUTION');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'SUBCONTRACTOR', 'CASUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'PERMIT';
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_DEADLINE';
ALTER TYPE "NotificationType" ADD VALUE 'STOCK_LOW';
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_INVITE';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assignedManagerId" TEXT,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "contactPerson" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "address" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "folder" TEXT,
ADD COLUMN     "gpsLat" DECIMAL(10,7),
ADD COLUMN     "gpsLng" DECIMAL(10,7),
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dayRate" DECIMAL(12,2),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "trade" TEXT,
DROP COLUMN "employmentType",
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "retentionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "MaterialLog" ADD COLUMN     "receiptKey" TEXT,
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "actualEndDate" TIMESTAMP(3),
ADD COLUMN     "gpsLat" DECIMAL(10,7),
ADD COLUMN     "gpsLng" DECIMAL(10,7),
ADD COLUMN     "projectManagerId" TEXT,
ADD COLUMN     "projectType" "ProjectType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "siteAddress" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "rejectionNotes" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoteId" TEXT,
    "variationNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "VariationType" NOT NULL DEFAULT 'ADDITION',
    "status" "VariationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationLineItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VariationLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_companyId_projectId_deletedAt_idx" ON "ProjectMember"("companyId", "projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_companyId_projectId_userId_key" ON "ProjectMember"("companyId", "projectId", "userId");

-- CreateIndex
CREATE INDEX "Variation_companyId_projectId_status_idx" ON "Variation"("companyId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_companyId_variationNumber_key" ON "Variation"("companyId", "variationNumber");

-- CreateIndex
CREATE INDEX "VariationLineItem_companyId_variationId_deletedAt_idx" ON "VariationLineItem"("companyId", "variationId", "deletedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_companyId_conversationId_deletedAt_idx" ON "ConversationParticipant"("companyId", "conversationId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_companyId_conversationId_userId_key" ON "ConversationParticipant"("companyId", "conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationLineItem" ADD CONSTRAINT "VariationLineItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationLineItem" ADD CONSTRAINT "VariationLineItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
