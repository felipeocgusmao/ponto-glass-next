-- #292: templates de turno passam a poder carregar o horário semanal completo
-- (folgas/horas por dia da semana, #287) e a flag "trabalha feriados", para
-- aplicar a mesma grelha a uma equipa inteira de uma vez em vez de repetir
-- funcionário a funcionário.

ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS weekly_schedule JSONB;
ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS works_holidays BOOLEAN NOT NULL DEFAULT false;
