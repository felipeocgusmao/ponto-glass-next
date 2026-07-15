-- #287: horário semanal por funcionário + quem trabalha fins de semana/feriados.
--
-- weekly_schedule: JSONB com chaves '0'(domingo)…'6'(sábado). Cada dia:
--   { "off": true }                              → folga nesse dia da semana
--   { "hours": 7, "start": "09:30", "end": "18:00" } → jornada/horário do dia
-- Campos omitidos caem nos valores únicos do funcionário (workday_hours,
-- expected_start, expected_end). NULL = sem horário semanal (comportamento
-- antigo: semana de segunda a sexta).
--
-- works_holidays: quando true, feriados de empresa (day_exceptions com
-- employee_id NULL) NÃO suprimem lembretes/verificações para este funcionário.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_schedule JSONB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS works_holidays BOOLEAN NOT NULL DEFAULT false;
