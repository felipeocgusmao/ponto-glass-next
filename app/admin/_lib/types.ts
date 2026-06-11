'use client'

export type Tab = 'meu_ponto' | 'status' | 'registros' | 'funcionarios' | 'relatorios' | 'dashboard' | 'auditoria' | 'banco' | 'feriados' | 'correcoes' | 'empresas'

// Appended to ALL_TABS only for super-admins (platform operators).
export const SUPER_ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: 'empresas', label: 'Empresas' },
]

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


export const AUDIT_LABELS: Record<string, string> = {
  employee_login:               '🔑 Login efetuado',
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
  tenant_create:                '🏢 Empresa criada',
  tenant_update:                '✏ Empresa atualizada',
  employee_import:              '📥 Importação de funcionários',
  totp_enabled:                 '🛡 2FA ativada',
  totp_disabled:                '🛡 2FA desativada',
}
