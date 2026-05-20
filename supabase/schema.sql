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
