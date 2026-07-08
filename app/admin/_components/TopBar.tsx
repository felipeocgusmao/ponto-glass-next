'use client'

import { useLang } from '@/lib/LangContext'
import type { Tab } from '../_lib/types'
import type { Notif } from '../_lib/useNotifications'
import {
  IconHamburger, SunIcon, MoonIcon,
  IconChevronRight, IconSearch, IconBell,
} from './icons'
import NotificationsDropdown from './NotificationsDropdown'

const PAGE_TITLES: Record<Tab, string> = {
  meu_ponto:    'tab.meu_ponto',
  dashboard:    'tab.dashboard',
  status:       'tab.status',
  registros:    'tab.registros',
  correcoes:    'tab.correcoes',
  funcionarios: 'tab.funcionarios',
  banco:        'tab.banco',
  ausencias:    'tab.ausencias',
  feriados:     'tab.feriados',
  relatorios:   'tab.relatorios',
  auditoria:    'tab.auditoria',
  empresas:     'tab.empresas',
  alertas:      'tab.alertas',
  integracoes:  'tab.integracoes',
  ajustes:      'tab.ajustes',
} as const

export default function TopBar({
  tab,
  theme,
  onToggleTheme,
  onOpenMobileNav,
  onOpenCmdK,
  notificationsOpen,
  onToggleNotifications,
  onNavigate,
  notifItems,
}: {
  tab: Tab
  theme: string
  onToggleTheme: () => void
  onOpenMobileNav: () => void
  onOpenCmdK: () => void
  notificationsOpen: boolean
  onToggleNotifications: () => void
  onNavigate: (tab: Tab) => void
  notifItems: Notif[]
}) {
  const { t } = useLang()
  const title = t(PAGE_TITLES[tab] as Parameters<typeof t>[0])
  const count = notifItems.length

  return (
    <div className="topbar">
      <button
        onClick={onOpenMobileNav}
        className="topbar-hamburger"
        aria-label={t('topbar.open_menu')}
      >
        <IconHamburger size={16} />
      </button>

      <div className="breadcrumbs">
        <span className="crumb">PontoGlass</span>
        <span className="sep"><IconChevronRight size={12} /></span>
        <span className="crumb current">{title}</span>
      </div>

      <button className="topbar-search" onClick={onOpenCmdK} aria-label={t('topbar.open_search')}>
        <IconSearch size={13} />
        <span className="placeholder">{t('topbar.search_placeholder')}</span>
        <kbd>⌘K</kbd>
      </button>

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={theme === 'dark' ? t('topbar.theme_light') : t('topbar.theme_dark')}
        aria-label={theme === 'dark' ? t('topbar.theme_light') : t('topbar.theme_dark')}
      >
        {theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
      </button>

      <div style={{ position: 'relative' }}>
        <button
          className="topbar-action"
          onClick={onToggleNotifications}
          title={t('topbar.notifications')}
          aria-label={t('topbar.notifications')}
          aria-expanded={notificationsOpen}
        >
          <IconBell size={14} />
          {count > 0 && (
            <span className="topbar-badge" aria-hidden="true">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
        <NotificationsDropdown
          open={notificationsOpen}
          onClose={() => { if (notificationsOpen) onToggleNotifications() }}
          onNavigate={onNavigate}
          items={notifItems}
        />
      </div>
    </div>
  )
}
