-- ═══════════════════════════════════════════════════════
--  PontoGlass — Tenant de demonstração isolado (/demo)
--  Execute no SQL Editor do Supabase.
--
--  Cria o tenant 'demo' e as três contas públicas de avaliação
--  DENTRO dele, isoladas dos dados do tenant principal. Se as
--  contas demo já existirem no tenant padrão (seed antigo,
--  seed-demo-users.sql), são MOVIDAS junto com seus registros,
--  auditoria e sessões.
--
--  Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
--  A senha de todas as contas é a pública 'demo1234' — por isso o
--  isolamento em tenant próprio é obrigatório.
-- ═══════════════════════════════════════════════════════

-- 1. Tenant de demonstração (login via /login?tenant=demo)
INSERT INTO tenants (name, slug, plan)
VALUES ('Demonstração', 'demo', 'standard')
ON CONFLICT (slug) DO NOTHING;

-- Kiosk token do demo, para o Modo Quiosque funcionar na avaliação.
UPDATE tenants SET kiosk_token = gen_random_uuid()::text
WHERE slug = 'demo' AND kiosk_token IS NULL;

-- 2. Mover contas demo criadas pelo seed antigo no tenant padrão
--    (o guard NOT EXISTS evita conflito de username se já houver cópia no demo)
UPDATE employees e
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
WHERE e.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND e.username IN ('admin_demo', 'gerente_demo', 'funcionario_demo')
  AND NOT EXISTS (
    SELECT 1 FROM employees d
    WHERE d.tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
      AND d.username = e.username
  );

-- 3. Criar as contas que ainda não existirem (bancos novos)
--    Senha: demo1234 (bcrypt, custo 10)
INSERT INTO employees (tenant_id, name, username, password_hash, role, hourly_rate)
SELECT t.id, v.name, v.username, v.hash, v.role, v.rate
FROM tenants t,
  (VALUES
    ('Admin Demo',       'admin_demo',       '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'admin',    NULL::numeric),
    ('Gerente Demo',     'gerente_demo',     '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'manager',  NULL),
    ('Funcionário Demo', 'funcionario_demo', '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'employee', 12.50)
  ) AS v(name, username, hash, role, rate)
WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, username) DO NOTHING;

-- 4. Levar junto os dados dependentes das contas demo (registros do seed
--    antigo, batidas de teste, trilha de auditoria e sessões de login)
WITH demo AS (SELECT id FROM tenants WHERE slug = 'demo'),
     demo_emps AS (
       SELECT id FROM employees
       WHERE tenant_id = (SELECT id FROM demo)
         AND username IN ('admin_demo', 'gerente_demo', 'funcionario_demo')
     )
UPDATE records SET tenant_id = (SELECT id FROM demo)
WHERE employee_id IN (SELECT id FROM demo_emps)
  AND tenant_id <> (SELECT id FROM demo);

WITH demo AS (SELECT id FROM tenants WHERE slug = 'demo'),
     demo_emps AS (
       SELECT id FROM employees
       WHERE tenant_id = (SELECT id FROM demo)
         AND username IN ('admin_demo', 'gerente_demo', 'funcionario_demo')
     )
UPDATE audit_logs SET tenant_id = (SELECT id FROM demo)
WHERE actor_id IN (SELECT id FROM demo_emps)
  AND tenant_id <> (SELECT id FROM demo);

-- login_sessions e push_subscriptions podem não existir em instalações mais
-- antigas (ver spin_off_tenant em 20260630_spin_off_tenant.sql) — o bloco DO
-- ignora a tabela ausente sem abortar o resto do script.
DO $$
BEGIN
  UPDATE login_sessions SET tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
  WHERE employee_id IN (
    SELECT id FROM employees
    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
      AND username IN ('admin_demo', 'gerente_demo', 'funcionario_demo')
  )
    AND tenant_id <> (SELECT id FROM tenants WHERE slug = 'demo');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$
BEGIN
  UPDATE push_subscriptions SET tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
  WHERE employee_id IN (
    SELECT id FROM employees
    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')
      AND username IN ('admin_demo', 'gerente_demo', 'funcionario_demo')
  )
    AND tenant_id <> (SELECT id FROM tenants WHERE slug = 'demo');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 5. Dois dias de registros de exemplo para o funcionário demo, para que
--    histórico, relatórios e holerite não abram vazios (só se não tiver nenhum)
WITH emp AS (
  SELECT e.id, e.name, e.tenant_id FROM employees e
  JOIN tenants t ON t.id = e.tenant_id
  WHERE t.slug = 'demo' AND e.username = 'funcionario_demo'
)
INSERT INTO records (tenant_id, employee_id, employee_name, type, timestamp, date)
SELECT emp.tenant_id, emp.id, emp.name, r.type, r.ts, r.d
FROM emp
CROSS JOIN (
  VALUES
    ('entrada',       ((CURRENT_DATE - 2) + TIME '09:00') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 2),
    ('inicio_almoco', ((CURRENT_DATE - 2) + TIME '13:00') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 2),
    ('fim_almoco',    ((CURRENT_DATE - 2) + TIME '14:00') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 2),
    ('saída',         ((CURRENT_DATE - 2) + TIME '17:30') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 2),
    ('entrada',       ((CURRENT_DATE - 1) + TIME '08:55') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 1),
    ('inicio_almoco', ((CURRENT_DATE - 1) + TIME '12:58') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 1),
    ('fim_almoco',    ((CURRENT_DATE - 1) + TIME '13:57') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 1),
    ('saída',         ((CURRENT_DATE - 1) + TIME '17:41') AT TIME ZONE 'Europe/Madrid', CURRENT_DATE - 1)
) AS r(type, ts, d)
WHERE NOT EXISTS (
  SELECT 1 FROM records rec WHERE rec.employee_id = emp.id
);

-- 6. Revogar o kiosk token do tenant PRINCIPAL criado durante os testes de
--    2026-07-02 (o quiosque do tenant principal volta ao estado "sem link",
--    como era antes). Apague esta linha se você usa o quiosque no principal.
UPDATE tenants SET kiosk_token = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';
