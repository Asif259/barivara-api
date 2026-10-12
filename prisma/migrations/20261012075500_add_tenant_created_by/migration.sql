-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_createdById_idx" ON "tenants"("createdById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_createdById_fkey'
  ) THEN
    ALTER TABLE "tenants" ADD CONSTRAINT "tenants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
