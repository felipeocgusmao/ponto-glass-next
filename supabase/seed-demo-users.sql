-- ═══════════════════════════════════════════════════════
--  PontoGlass — Seed dos usuários de demonstração (/demo)
--  Execute no SQL Editor do Supabase.
--
--  ⚠️ Apenas para instâncias de DEMONSTRAÇÃO: cria contas com a
--  senha pública 'demo1234' anunciada na página /demo. Nunca rode
--  num banco com dados reais.
--
--  Idempotente: ON CONFLICT DO NOTHING não toca contas existentes
--  (em particular a conta real 'admin'), e os registros de exemplo
--  só são inseridos se o funcionário demo ainda não tiver nenhum.
-- ═══════════════════════════════════════════════════════

-- Senha de todas as contas: demo1234 (bcrypt, custo 10)
INSERT INTO employees (tenant_id, name, username, password_hash, role, hourly_rate)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin Demo',       'admin_demo',       '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'admin',    NULL),
  ('00000000-0000-0000-0000-000000000001', 'Gerente Demo',     'gerente_demo',     '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'manager',  NULL),
  ('00000000-0000-0000-0000-000000000001', 'Funcionário Demo', 'funcionario_demo', '$2a$10$oTMWp..6rnZntZKmdSHqJu7ArL80YG1voqV0SuOIqIQMmyquLyUhm', 'employee', 12.50)
ON CONFLICT (tenant_id, username) DO NOTHING;

-- Dois dias de registros de exemplo para o funcionário demo, para que
-- histórico, relatórios e holerite não abram vazios na avaliação.
WITH emp AS (
  SELECT id, name FROM employees
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND username = 'funcionario_demo'
)
INSERT INTO records (tenant_id, employee_id, employee_name, type, timestamp, date)
SELECT '00000000-0000-0000-0000-000000000001', emp.id, emp.name, r.type, r.ts, r.d
FROM emp, LATERAL (
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
