-- ════════════════════════════════════════════════════════════════════════════
--  OPCIONAL / MANUAL — Backfill de records.date para o dia LOCAL (Issue #69)
--
--  ⚠️  NÃO é aplicado automaticamente e NÃO deve ser executado às cegas.
--      O passo de UPDATE está COMENTADO de propósito. Rode o DRY-RUN primeiro.
--
--  Contexto
--  --------
--  Até o PR #64, `records.date` era gravado pelo dia UTC. A partir do #64, novas
--  batidas usam o dia LOCAL do fuso da empresa (NEXT_PUBLIC_BUSINESS_TZ, padrão
--  Europe/Madrid). Em Espanha (UTC+1/+2) o dia UTC só difere do dia local para
--  batidas entre 00:00–02:00 locais, que ficaram gravadas no dia anterior.
--
--  Este script recalcula `date` para o dia local desses registros históricos, de
--  modo que relatórios de meses passados fiquem consistentes com o comportamento novo.
--
--  Escopo: apenas funcionários de turno normal (shift_start = '00:00' ou nulo).
--  Para turnos noturnos (shift_start != '00:00'), revise manualmente — a regra de
--  data é diferente (ver calcWorkDate em lib/utils.ts).
--
--  IMPORTANTE: troque 'Europe/Madrid' abaixo se mudar o NEXT_PUBLIC_BUSINESS_TZ.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) DRY-RUN — rode ISTO primeiro. Lista os registros que mudariam (e para qual data).
--    Se vier vazio, não há nada a corrigir (provável, se ninguém bate ponto 00:00–02:00).
SELECT
  r.id,
  r.employee_name,
  r.timestamp,
  r.date                                            AS data_atual,
  (r.timestamp AT TIME ZONE 'Europe/Madrid')::date  AS data_local
FROM records r
JOIN employees e ON e.id = r.employee_id
WHERE COALESCE(e.shift_start::text, '00:00') = '00:00'
  AND r.date <> (r.timestamp AT TIME ZONE 'Europe/Madrid')::date
ORDER BY r.timestamp;

-- 2) APLICAR — só depois de revisar o resultado do passo 1. Descomente e rode dentro
--    de uma transação para poder conferir a contagem antes do COMMIT.
--
-- BEGIN;
--   UPDATE records r
--      SET date = (r.timestamp AT TIME ZONE 'Europe/Madrid')::date
--     FROM employees e
--    WHERE e.id = r.employee_id
--      AND COALESCE(e.shift_start::text, '00:00') = '00:00'
--      AND r.date <> (r.timestamp AT TIME ZONE 'Europe/Madrid')::date;
--   -- Confira o número de linhas afetadas; se estiver certo:
-- COMMIT;
--   -- (ou ROLLBACK; para abortar)
