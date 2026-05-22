'use client'

export type Tab = 'meu_ponto' | 'status' | 'registros' | 'funcionarios' | 'relatorios' | 'dashboard' | 'auditoria' | 'banco' | 'feriados' | 'correcoes'

export const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'meu_ponto',    label: 'Meu Ponto'  },
  { id: 'dashboard',    label: 'Dashboard'  },
  { id: 'status',       label: 'Status'     },
  { id: 'registros',    label: 'Registros'  },
  { id: 'correcoes',    label: 'Correções'  },
  { id: 'funcionarios', label: 'Equipe'     },
  { id: 'banco',        label: 'Banco'      },
  { id: 'feriados',     label: 'Feriados'   },
  { id: 'relatorios',   label: 'Relatório'  },
  { id: 'auditoria',    label: 'Auditoria'  },
]

export const MANAGER_TABS: { id: Tab; label: string }[] = [
  { id: 'meu_ponto',    label: 'Meu Ponto'  },
  { id: 'dashboard',    label: 'Dashboard'  },
  { id: 'status',       label: 'Status'     },
  { id: 'registros',    label: 'Registros'  },
  { id: 'correcoes',    label: 'Correções'  },
  { id: 'banco',        label: 'Banco'      },
  { id: 'feriados',     label: 'Feriados'   },
  { id: 'relatorios',   label: 'Relatório'  },
]

export const WORKING_TYPES = ['entrada', 'fim_almoco', 'retorno_cafe']

export const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

export const AUDIT_LABELS: Record<string, string> = {
  employee_create:              '👤 Funcionário criado',
  employee_update:              '✏ Funcionário atualizado',
  employee_delete:              '🗑 Funcionário desativado',
  record_create:                '➕ Registo criado',
  record_update:                '✏ Registo editado',
  record_delete:                '🗑 Registo apagado',
  punch_on_behalf:              '▶ Ponto registado por admin',
  hour_bank_adjustment:         '⚖ Ajuste banco de horas',
  hour_bank_adjustment_delete:  '🗑 Ajuste banco removido',
  day_exception_create:         '📅 Feriado/folga criado',
  day_exception_delete:         '🗑 Feriado/folga removido',
  correction_approved:          '✅ Correção aprovada',
  correction_rejected:          '✕ Correção rejeitada',
}
