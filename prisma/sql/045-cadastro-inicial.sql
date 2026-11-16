ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "selfSignupEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "selfSignupExempt" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_selfSignupEmail_key" ON "Tenant"("selfSignupEmail");
