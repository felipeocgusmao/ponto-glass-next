-- 20260708_missing_prod_tables.sql
-- Cria as 5 tabelas que existiam apenas no schema.sql (nunca versionadas como
-- migration) e que faltam em instalações antigas de produção — a causa do erro
-- "Could not find the table 'public.kiosk_photos'" ao eliminar uma empresa.
-- 100% idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS): seguro re-rodar.
-- Rode no Supabase → SQL Editor. Em bancos que já têm as tabelas, é no-op.

-- Webhooks de saída (uma entrega POST assinada por batida).
CREATE TABLE IF NOT EXISTS webhook_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  secret      TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  events      TEXT[]      NOT NULL DEFAULT ARRAY['punch'],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant ON webhook_configs(tenant_id);

-- Templates de turno reutilizáveis (aplicáveis a vários funcionários de uma vez).
CREATE TABLE IF NOT EXISTS shift_templates (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL,
  workday_hours       DECIMAL(4,2) NOT NULL DEFAULT 8,
  lunch_break_minutes INT          NOT NULL DEFAULT 60,
  expected_start      TIME,
  expected_end        TIME,
  shift_start         TIME         NOT NULL DEFAULT '00:00',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_templates_tenant ON shift_templates(tenant_id);

-- Aprovação de semana (timesheet lock) por funcionário.
CREATE TABLE IF NOT EXISTS timesheet_approvals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  week_start        DATE        NOT NULL,
  approved_by_name  TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_tenant ON timesheet_approvals(tenant_id);

-- Histórico de sessões de login (IP, user agent, revogação individual).
CREATE TABLE IF NOT EXISTS login_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_login_sessions_tenant_emp ON login_sessions(tenant_id, employee_id);

-- Foto capturada no momento da batida no quiosque (≤ 300KB, validado na rota).
CREATE TABLE IF NOT EXISTS kiosk_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_id   UUID        NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  photo_data  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kiosk_photos_tenant_record ON kiosk_photos(tenant_id, record_id);

-- Defence-in-depth RLS: refuse any access with the anon key (app uses service-role).
ALTER TABLE webhook_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_photos        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_anon_webhook_configs"     ON webhook_configs;
DROP POLICY IF EXISTS "block_anon_shift_templates"     ON shift_templates;
DROP POLICY IF EXISTS "block_anon_timesheet_approvals" ON timesheet_approvals;
DROP POLICY IF EXISTS "block_anon_login_sessions"      ON login_sessions;
DROP POLICY IF EXISTS "block_anon_kiosk_photos"        ON kiosk_photos;

CREATE POLICY "block_anon_webhook_configs"     ON webhook_configs     AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_shift_templates"     ON shift_templates     AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_timesheet_approvals" ON timesheet_approvals AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_login_sessions"      ON login_sessions      AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_kiosk_photos"        ON kiosk_photos        AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
