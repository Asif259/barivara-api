-- Add OWNER_SIGNATURE to FileCategory enum
ALTER TYPE "FileCategory" ADD VALUE 'OWNER_SIGNATURE';

-- Add owner signature file reference on users
ALTER TABLE "users" ADD COLUMN "signatureFileId" TEXT;

-- Add signature snapshot reference on payments for historical receipt consistency
ALTER TABLE "payments" ADD COLUMN "ownerSignatureSnapshotId" TEXT;
