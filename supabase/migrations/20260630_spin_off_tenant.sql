-- spin_off_tenant() — atomically creates a new tenant and moves every
-- per-tenant row into it. Used to separate the platform (default) tenant —
-- home of super-admin "controller" accounts — from a client company's
-- operational data (employees, punches, ...), so the company can be
-- activated/deactivated/deleted like any other client without ever risking
-- platform access. See app/api/tenants/[id]/spin-off.
--
-- Run this once in the Supabase SQL Editor before using the "Separar
-- plataforma" action in the Empresas tab. Also included in schema.sql
-- (v16 → v17) for fresh installs.
--
-- Runs as a single Postgres function so the whole move is one transaction:
-- if any REQUIRED table fails, Postgres rolls back everything automatically
-- (nothing half-moved). OPTIONAL tables (webhook_configs, shift_templates,
-- timesheet_approvals, login_sessions, kiosk_photos — which may not exist on
-- every install) are wrapped in their own sub-block so a missing table there
-- doesn't abort the rest of the migration.
CREATE OR REPLACE FUNCTION spin_off_tenant(
  p_source_tenant_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_domain TEXT
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_tenant_id UUID;
BEGIN
  INSERT INTO tenants (name, slug, domain, plan)
  VALUES (p_name, p_slug, p_domain, 'standard')
  RETURNING id INTO v_new_tenant_id;

  -- Strip super_admin from accounts moving out of the platform tenant — an
  -- operational client-company admin must not retain platform-wide power.
  UPDATE employees SET tenant_id = v_new_tenant_id, super_admin = false
    WHERE tenant_id = p_source_tenant_id;
  UPDATE records               SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE correction_requests   SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE compensation_requests SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE hour_bank_adjustments SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE day_exceptions        SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE audit_logs            SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  UPDATE push_subscriptions    SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;

  BEGIN
    UPDATE webhook_configs SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    UPDATE shift_templates SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    UPDATE timesheet_approvals SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    UPDATE login_sessions SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    UPDATE kiosk_photos SET tenant_id = v_new_tenant_id WHERE tenant_id = p_source_tenant_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  RETURN v_new_tenant_id;
END;
$$;

-- Only the app's service-role key may call this — it bypasses every per-row
-- check, by design (it IS the bulk per-tenant move).
REVOKE ALL ON FUNCTION spin_off_tenant(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION spin_off_tenant(UUID, TEXT, TEXT, TEXT) TO service_role;
