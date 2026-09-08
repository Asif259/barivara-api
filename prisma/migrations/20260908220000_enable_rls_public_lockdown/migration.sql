-- ==============================================================================
-- Migration: 20260908220000_enable_rls_public_lockdown
-- Purpose:
--   1. Enable Row-Level Security (RLS) on all 11 application tables and _prisma_migrations.
--   2. Enforce default-deny on Supabase PostgREST (roles: anon, authenticated).
--   3. Revoke all table, sequence, and routine privileges from anon and authenticated.
--   4. Alter default privileges to prevent auto-granting access on future public objects.
-- Note:
--   - Does NOT use FORCE ROW LEVEL SECURITY (Prisma's 'postgres' role bypasses RLS).
--   - Does NOT create auth.uid() policies (BariVara uses custom NestJS JWTs).
-- ==============================================================================

-- 1. Enable Row-Level Security on all 11 business tables
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monthly_rents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

-- 2. Enable Row-Level Security on Prisma internal migrations table
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- 3. Defense-in-depth: Revoke existing permissions from PostgREST roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- 4. Defense-in-depth: Prevent auto-granting permissions on future tables/sequences/routines
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
