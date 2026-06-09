-- v11 → v12: multi-tenancy foundation (issue #6, phase 1 / 5)
--
-- Adds the `tenants` table and a `tenant_id` column to every entity that holds
-- per-company data. The migration is pure DDL + backfill: there is no code
-- change in this phase, so existing single-tenant deployments keep working
-- because every existing row is moved into a "default" tenant and every new
-- INSERT picks up the default tenant id via the column DEFAULT.
--
-- The DEFAULT is the bridge that makes this phase backwards-compatible:
-- legacy API code that does not yet pass tenant_id keeps inserting cleanly,
-- and phase 2 will start overriding the default with the tenant_id taken from
-- the request's JWT.

-- ── 1. tenants table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  -- slug: used by the default subdomain (slug.pontoglass.app) and as a stable
  -- handle in URLs/logs. Lowercase, hyphen-separated, unique.
  slug       TEXT        NOT NULL UNIQUE
                         CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 40),
  -- domain: optional custom domain (e.g. ponto.empresa.com). Wired up in phase 4.
  domain     TEXT        UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'standard',
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. default tenant (deterministic id so app code can reference it) ──────
-- The id is fixed and well-known so phase 2 can fall back to it during the
-- transition window without a lookup.
INSERT INTO tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'standard')
ON CONFLICT (id) DO NOTHING;

-- ── 3. tenant_id columns with DEFAULT pointing at the default tenant ───────
-- DEFAULT + NOT NULL = phase-1 app code keeps inserting without specifying
-- tenant_id; phase 2 will override the default explicitly.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE hour_bank_adjustments
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE day_exceptions
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE correction_requests
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

-- ── 4. tenant-scoped unique constraints ────────────────────────────────────
-- employees.username was UNIQUE globally; the same username can legitimately
-- exist in two different tenants (different people, different companies), so
-- the constraint becomes (tenant_id, username).
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_username_key;
ALTER TABLE employees
  ADD CONSTRAINT employees_tenant_username_key UNIQUE (tenant_id, username);

-- push_subscriptions had UNIQUE (employee_id); employee_id is already
-- tenant-scoped (one row per employee, per tenant inherently), so nothing
-- changes here. Left as a NOTE for future readers.

-- ── 5. indexes for tenant-scoped queries (every list/report filters by tenant) ──
CREATE INDEX IF NOT EXISTS idx_employees_tenant            ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_records_tenant_date         ON records(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_records_tenant_emp_date     ON records(tenant_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created        ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_tenant_status   ON correction_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_tenant_employee        ON hour_bank_adjustments(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_day_exceptions_tenant_date  ON day_exceptions(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_push_tenant                 ON push_subscriptions(tenant_id);

-- ── 6. RLS on the tenants table itself ─────────────────────────────────────
-- Same defensive baseline as the other tables: deny anon reads, the service
-- role used by the API bypasses RLS. Tenant-aware policies come in phase 3.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_anon_read_tenants" ON tenants
  FOR SELECT USING (false);
