-- v13 → v14: phase 5 of multi-tenancy — super-admin flag.
--
-- A super-admin is a platform operator: they can list, create and edit
-- tenants via /api/tenants and the "Empresas" admin tab. The flag is a
-- boolean on employees (not a new role) so an existing admin keeps their
-- normal admin powers inside their own tenant, plus the platform scope.
--
-- The flag is never read from the JWT — verifyApiAuth loads it from the
-- database on every request, so revoking it takes effect immediately.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill: active admins of the default tenant become super-admins. Before
-- multi-tenancy they effectively WERE the platform owners — this preserves
-- exactly that. Admins of any other tenant stay tenant-scoped.
UPDATE employees
SET super_admin = true
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND role = 'admin'
  AND active = true;
