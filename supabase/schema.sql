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
                            CHECK (role IN ('admin', 'employee')),
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de registros de ponto
CREATE TABLE IF NOT EXISTS records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES employees(id),
  employee_name TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('entrada', 'saída')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date          DATE        NOT NULL DEFAULT CURRENT_DATE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_records_employee ON records(employee_id);
CREATE INDEX IF NOT EXISTS idx_records_date     ON records(date);
CREATE INDEX IF NOT EXISTS idx_records_emp_date ON records(employee_id, date);

-- ⚠️  O usuário admin padrão (admin / admin123) é criado
--     automaticamente pelo app no primeiro login.
--     Troque a senha logo após o primeiro acesso.
