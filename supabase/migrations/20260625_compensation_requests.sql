-- Compensation (hour-bank) requests submitted by employees
CREATE TABLE IF NOT EXISTS compensation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  employee_name   TEXT NOT NULL,
  date            DATE NOT NULL,
  hours_requested NUMERIC(4,2) NOT NULL CHECK (hours_requested > 0),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  reviewer_id     UUID REFERENCES employees(id),
  reviewer_name   TEXT,
  reviewer_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comp_req_tenant_emp
  ON compensation_requests(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_comp_req_tenant_status
  ON compensation_requests(tenant_id, status);

-- Kiosk token per tenant (UUID generated on first use)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_token TEXT;

-- Defence-in-depth RLS: refuse any access with the anon key (app uses service-role).
-- Mirrors the lockdown applied to every other per-tenant table in schema.sql.
ALTER TABLE compensation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_anon_compensation" ON compensation_requests;
CREATE POLICY "block_anon_compensation" ON compensation_requests
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
