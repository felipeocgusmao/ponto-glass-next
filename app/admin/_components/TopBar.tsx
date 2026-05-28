'use client'

import { useLang } from '@/lib/LangContext'
import type { Tab } from '../_lib/types'
import {
  IconHamburger, SunIcon, MoonIcon,
  IconChevronRight, IconSearch, IconBell,
} from './icons'

const PAGE_TITLES: Record<Tab, string> = {
  meu_ponto:    'tab.meu_ponto',
  dashboard:    'tab.dashboard',
  status:       'tab.status',
  registros:    'tab.registros',
  correcoes:    'tab.correcoes',
  funcionarios: 'tab.funcionarios',
  banco:        'tab.banco',
  feriados:     'tab.feriados',
  relatorios:   'tab.relatorios',
  auditoria:    'tab.auditoria',
} as const

export default function TopBar({
  tab,
  theme,
  onToggleTheme,
  onOpenMobileNav,
  onOpenCmdK,
}: {
  tab: Tab
  theme: string
  onToggleTheme: () => void
  onOpenMobileNav: () => void
  onOpenCmdK: () => void
}) {
  const { t } = useLang()
  const title = t(PAGE_TITLES[tab] as Parameters<typeof t>[0])

  return (
    <div className="topbar">
      <button
        onClick={onOpenMobileNav}
        className="topbar-hamburger"
        aria-label="Abrir menu"
      >
        <IconHamburger />
      </button>

      <div className="breadcrumbs">
        <span className="crumb">PontoGlass</span>
        <span className="sep"><IconChevronRight size={12} /></span>
        <span className="crumb current">{title}</span>
      </div>

      <button className="topbar-search" onClick={onOpenCmdK} aria-label="Abrir busca">
        <IconSearch size={13} />
        <span className="placeholder">Buscar funcionários, registros…</span>
        <kbd>⌘K</kbd>
      </button>

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <button className="topbar-action" title="Notificações">
        <IconBell size={14} />
        <span className="dot" />
      </button>
    </div>
  )
}
