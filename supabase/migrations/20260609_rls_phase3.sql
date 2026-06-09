-- v12 → v13: phase 3 of multi-tenancy — defence-in-depth RLS lockdown.
--
-- Reality check on the threat model
-- ---------------------------------
-- The app talks to Postgres via the Supabase *service role* key, which BYPASSES
-- row-level security entirely. So no policy written here can stop a bug in the
-- API from leaking data across tenants — that isolation comes from the explicit
-- `.eq('tenant_id', user.tenant_id)` clauses introduced in phase 2.
--
-- What RLS actually buys us here is the defence-in-depth corner:
--   - If somebody ever hits the database with the *anon* key (e.g. someone
--     accidentally swaps the env var, or wires a public Supabase client into a
--     marketing page), every read/write must be refused.
--   - If a future migration forgets to ENABLE RLS, the catalog still shows the
--     table is permissive — these CREATE POLICY blocks make the lockdown
--     explicit and discoverable.
--
-- A future phase (if/when we ever migrate to Supabase Auth instead of our own
-- JWT) can replace the `block_anon_*` policies with tenant-aware ones driven by
-- `auth.jwt() ->> 'tenant_id'`. A template is included at the bottom of this
-- file in a comment block.

-- ── 1. Enable RLS on every per-tenant table ────────────────────────────────
-- ENABLE is idempotent (a no-op when already enabled), so this file can be
-- replayed on databases that already have phase 1's RLS bits in place.
ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_exceptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;

-- ── 2. Lock the anon role out of every operation on every per-tenant table ─
-- Without a permissive policy the role can do nothing, but Postgres' default
-- error message is opaque ("permission denied"). The empty-row policies below
-- generate the same outcome with an explicit, greppable name in pg_policies.
--
-- USING(false): SELECT/UPDATE/DELETE find no row they're allowed to touch.
-- WITH CHECK(false): INSERT/UPDATE produces no row that would survive the check.
--
-- `IF NOT EXISTS` keeps the migration idempotent so it can be replayed on
-- databases that already received phase 1's narrower SELECT-only block_anon_*
-- policies — those will simply be replaced by the broader policies below.

-- employees
DROP POLICY IF EXISTS "block_anon_read_employees" ON employees;
DROP POLICY IF EXISTS "block_anon_employees" ON employees;
CREATE POLICY "block_anon_employees" ON employees AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- records
DROP POLICY IF EXISTS "block_anon_read_records" ON records;
DROP POLICY IF EXISTS "block_anon_records" ON records;
CREATE POLICY "block_anon_records" ON records AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- correction_requests
DROP POLICY IF EXISTS "block_anon_read_corrections" ON correction_requests;
DROP POLICY IF EXISTS "block_anon_corrections" ON correction_requests;
CREATE POLICY "block_anon_corrections" ON correction_requests AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- audit_logs
DROP POLICY IF EXISTS "block_anon_read_audit" ON audit_logs;
DROP POLICY IF EXISTS "block_anon_audit" ON audit_logs;
CREATE POLICY "block_anon_audit" ON audit_logs AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- day_exceptions
DROP POLICY IF EXISTS "block_anon_day_exceptions" ON day_exceptions;
CREATE POLICY "block_anon_day_exceptions" ON day_exceptions AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- hour_bank_adjustments
DROP POLICY IF EXISTS "block_anon_hour_bank" ON hour_bank_adjustments;
CREATE POLICY "block_anon_hour_bank" ON hour_bank_adjustments AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- push_subscriptions
DROP POLICY IF EXISTS "block_anon_push_subscriptions" ON push_subscriptions;
CREATE POLICY "block_anon_push_subscriptions" ON push_subscriptions AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- tenants (already has block_anon_read_tenants from phase 1; widen it)
DROP POLICY IF EXISTS "block_anon_read_tenants" ON tenants;
DROP POLICY IF EXISTS "block_anon_tenants" ON tenants;
CREATE POLICY "block_anon_tenants" ON tenants AS RESTRICTIVE
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ── 3. Template for tenant-aware RLS (future) ──────────────────────────────
-- These are commented because the current app uses the service-role key, which
-- bypasses RLS — these policies would never fire. They become live the day we
-- migrate to Supabase Auth and start issuing per-user JWTs whose `tenant_id`
-- claim Postgres can inspect via `auth.jwt() ->> 'tenant_id'`.
--
-- Apply them in a future migration alongside the auth migration; do NOT apply
-- here, or every authenticated read in production will return zero rows.
--
-- Example for `records` (the pattern is the same for every tenant-scoped table):
--
--   CREATE POLICY "tenant_isolation_records_select" ON records
--     FOR SELECT TO authenticated
--     USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
--   CREATE POLICY "tenant_isolation_records_modify" ON records
--     FOR ALL TO authenticated
--     USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
--     WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
