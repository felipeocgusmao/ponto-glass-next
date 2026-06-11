-- ═══════════════════════════════════════════════════════
--  PontoGlass — Schema Supabase
--  Execute no SQL Editor do seu projeto em supabase.com
-- ═══════════════════════════════════════════════════════

-- Tabela de funcionários
CREATE TABLE IF NOT EXISTS employees (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  username      TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'employee'
                            CHECK (role IN ('admin', 'manager', 'employee')),
  active        BOOLEAN     NOT NULL DEFAULT true,
  workday_hours       DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  lunch_break_minutes INT          NOT NULL DEFAULT 60,
  hourly_rate         DECIMAL(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de registros de ponto
CREATE TABLE IF NOT EXISTS records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES employees(id),
  employee_name TEXT        NOT NULL,
  type          TEXT        NOT NULL
                            CHECK (type IN ('entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date          DATE        NOT NULL DEFAULT CURRENT_DATE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_records_employee ON records(employee_id);
CREATE INDEX IF NOT EXISTS idx_records_date     ON records(date);
CREATE INDEX IF NOT EXISTS idx_records_emp_date ON records(employee_id, date);

-- ═══════════════════════════════════════════════════════
--  Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE records   ENABLE ROW LEVEL SECURITY;

-- ⚠️  O usuário admin padrão (admin / admin123) é criado
--     automaticamente pelo app no primeiro login.
--     Troque a senha logo após o primeiro acesso.

-- ═══════════════════════════════════════════════════════
--  Migrações para bancos existentes
--  Execute apenas se o banco foi criado em versão anterior.
-- ═══════════════════════════════════════════════════════

-- v1 → v2: configurações individuais por funcionário
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS workday_hours      DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  ADD COLUMN IF NOT EXISTS lunch_break_minutes INT          NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS hourly_rate        DECIMAL(10,2);

-- v2 → v3: papel gerente
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin', 'manager', 'employee'));

-- v3 → v4: tipos de pausa explícita (almoço / café)
ALTER TABLE records
  DROP CONSTRAINT IF EXISTS records_type_check;
ALTER TABLE records
  ADD CONSTRAINT records_type_check
  CHECK (type IN ('entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe'));

-- v4 → v5: geolocalização, banco de horas e audit log
ALTER TABLE records
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS geo_mode TEXT NOT NULL DEFAULT 'optional'
    CHECK (geo_mode IN ('required', 'optional', 'disabled'));

CREATE TABLE IF NOT EXISTS hour_bank_adjustments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID        NOT NULL REFERENCES employees(id),
  minutes     INTEGER     NOT NULL,
  reason      TEXT        NOT NULL,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID        REFERENCES employees(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES employees(id),
  actor_name  TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  target_id   UUID,
  target_name TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_bank_employee    ON hour_bank_adjustments(employee_id);

-- v5 → v6: campo email + feriados/folgas
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS day_exceptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('holiday', 'day_off')),
  description TEXT        NOT NULL,
  employee_id UUID        REFERENCES employees(id),
  created_by  UUID        REFERENCES employees(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_exceptions_date     ON day_exceptions(date);
CREATE INDEX IF NOT EXISTS idx_day_exceptions_employee ON day_exceptions(employee_id);

-- v6 → v7: fluxo de correção de batidas
CREATE TABLE IF NOT EXISTS correction_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT        NOT NULL,
  req_type        TEXT        NOT NULL CHECK (req_type IN ('entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe')),
  req_timestamp   TIMESTAMPTZ NOT NULL,
  req_date        DATE        NOT NULL,
  reason          TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id     UUID        REFERENCES employees(id),
  reviewer_name   TEXT,
  reviewer_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_corrections_employee ON correction_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status   ON correction_requests(status);

-- v7 → v8: lock_profile — admin can prevent employees from changing their password
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS lock_profile BOOLEAN NOT NULL DEFAULT false;

-- v8 → v9: schedule fields + night shift + record comments
ALTER TABLE records    ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS expected_start TIME;
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS expected_end   TIME;
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS shift_start    TIME NOT NULL DEFAULT '00:00';
-- shift_start: LOCAL (business-timezone) time at which a new workday begins.
-- '00:00' = normal day shift (work date = the local calendar day).
-- '22:00' = night shift starting at 22:00 local — punches before 22:00 local belong to the previous day.
-- The business timezone is set via NEXT_PUBLIC_BUSINESS_TZ (default Europe/Madrid).

-- v10.5: push subscriptions (Web Push / tokens nativos) — uma por funcionário.
-- Estava apenas em migrations/20260522_push_subscriptions.sql; precisa existir
-- aqui também porque os blocos de multi-tenancy abaixo fazem ALTER nela e uma
-- instalação nova (que corre só este ficheiro) falharia.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  subscription JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id)
);

-- v9 → v10: revogação de sessão — logout e troca/reset de senha invalidam tokens
-- emitidos antes deste instante (a API rejeita tokens com iat < sessions_valid_from).
-- O default é a época (1970), NÃO now(): ao adicionar a coluna numa base já existente,
-- now() marcaria todas as linhas com o instante da migração e revogaria de imediato TODAS
-- as sessões abertas (todos caem para a tela de login). Com a época, nenhum token nasce
-- revogado — só logout/troca de senha avançam o sessions_valid_from e revogam de facto.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS sessions_valid_from TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0);

-- v11 → v12: multi-tenancy foundation (issue #6, phase 1 / 5)
-- Adds tenants table and a tenant_id column on every per-company entity.
-- DEFAULT points at a deterministic "default" tenant so legacy INSERTs (that
-- don't yet supply tenant_id) keep working until phase 2 wires the JWT through.
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE
                         CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 40),
  domain     TEXT        UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'standard',
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'standard')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE employees             ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE records               ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE hour_bank_adjustments ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE audit_logs            ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE day_exceptions        ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE correction_requests   ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE push_subscriptions    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_username_key;
-- ADD CONSTRAINT não suporta IF NOT EXISTS; o DO-block mantém o ficheiro re-executável.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tenant_username_key') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_tenant_username_key UNIQUE (tenant_id, username);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_tenant            ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_records_tenant_date         ON records(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_records_tenant_emp_date     ON records(tenant_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created        ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_tenant_status   ON correction_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_tenant_employee        ON hour_bank_adjustments(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_day_exceptions_tenant_date  ON day_exceptions(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_push_tenant                 ON push_subscriptions(tenant_id);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- v12 → v13: phase 3 of multi-tenancy — defence-in-depth RLS lockdown.
-- The app uses the service-role key (which bypasses RLS), so tenant isolation
-- comes from the API filters added in phase 2. These policies exist solely to
-- refuse anything that ever hits the database with the anon key — every read
-- AND write on every per-tenant table.

ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_exceptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_anon_read_employees"    ON employees;
DROP POLICY IF EXISTS "block_anon_read_records"      ON records;
DROP POLICY IF EXISTS "block_anon_read_corrections"  ON correction_requests;
DROP POLICY IF EXISTS "block_anon_read_audit"        ON audit_logs;
DROP POLICY IF EXISTS "block_anon_read_tenants"      ON tenants;

DROP POLICY IF EXISTS "block_anon_employees"           ON employees;
DROP POLICY IF EXISTS "block_anon_records"             ON records;
DROP POLICY IF EXISTS "block_anon_corrections"         ON correction_requests;
DROP POLICY IF EXISTS "block_anon_audit"               ON audit_logs;
DROP POLICY IF EXISTS "block_anon_day_exceptions"      ON day_exceptions;
DROP POLICY IF EXISTS "block_anon_hour_bank"           ON hour_bank_adjustments;
DROP POLICY IF EXISTS "block_anon_push_subscriptions"  ON push_subscriptions;
DROP POLICY IF EXISTS "block_anon_tenants"             ON tenants;

CREATE POLICY "block_anon_employees"          ON employees             AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_records"            ON records               AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_corrections"        ON correction_requests   AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_audit"              ON audit_logs            AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_day_exceptions"     ON day_exceptions        AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_hour_bank"          ON hour_bank_adjustments AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_push_subscriptions" ON push_subscriptions    AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "block_anon_tenants"            ON tenants               AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- v13 → v14: phase 5 of multi-tenancy — super-admin flag (platform operator).
-- Active admins of the default tenant are backfilled as super-admins; they
-- were the de-facto platform owners before multi-tenancy existed.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE employees
SET super_admin = true
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND role = 'admin'
  AND active = true;
