'use client'

import { avatarInitials } from '@/lib/utils'
import type { EmployeeProfile } from '@/lib/types'
import type { Tab } from '../_lib/types'
import { empColor } from '../_lib/helpers'
import { useLang, type Lang } from '@/lib/LangContext'
import {
  IconClock, IconDashboard, IconStatus, IconList, IconUsers,
  IconBank, IconCalendar, IconBar, IconAudit, IconEdit,
  IconChevronsLeft, IconSettings, IconBuilding, IconBell,
} from './icons'

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  meu_ponto:    <IconClock />,
  dashboard:    <IconDashboard />,
  status:       <IconStatus />,
  registros:    <IconList />,
  correcoes:    <IconEdit />,
  funcionarios: <IconUsers />,
  banco:        <IconBank />,
  ausencias:    <IconUsers />,
  feriados:     <IconCalendar />,
  relatorios:   <IconBar />,
  auditoria:    <IconAudit />,
  empresas:     <IconBuilding />,
  alertas:      <IconBell />,
  integracoes:  <IconSettings />,
}

const NAV_GROUPS: { key: string; labels: Record<Lang, string>; tabs: Tab[] }[] = [
  {
    key: 'operacao',
    labels: { 'pt-PT': 'Operação', 'pt-BR': 'Operação', 'en': 'Operations', 'es': 'Operación' },
    tabs: ['dashboard', 'status', 'registros', 'correcoes', 'meu_ponto'],
  },
  {
    key: 'pessoas',
    labels: { 'pt-PT': 'Pessoas', 'pt-BR': 'Pessoas', 'en': 'People', 'es': 'Personas' },
    tabs: ['funcionarios', 'banco', 'feriados'],
  },
  {
    key: 'analise',
    labels: { 'pt-PT': 'Análise', 'pt-BR': 'Análise', 'en': 'Analysis', 'es': 'Análisis' },
    tabs: ['relatorios', 'ausencias', 'auditoria'],
  },
  {
    key: 'sistema',
    labels: { 'pt-PT': 'Sistema', 'pt-BR': 'Sistema', 'en': 'System', 'es': 'Sistema' },
    tabs: ['alertas', 'integracoes'],
  },
  {
    key: 'plataforma',
    labels: { 'pt-PT': 'Plataforma', 'pt-BR': 'Plataforma', 'en': 'Platform', 'es': 'Plataforma' },
    tabs: ['empresas'],
  },
]

export default function Sidebar({
  tab, setTab, tabs, user, onOpenSettings,
  mobileOpen, onMobileClose, collapsed, onToggleCollapse, badges = {},
}: {
  tab: Tab
  setTab: (t: Tab) => void
  tabs: { id: Tab; label: string }[]
  user: EmployeeProfile
  onOpenSettings: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  badges?: Partial<Record<Tab, number>>
}) {
  const { lang, t } = useLang()
  const ci = empColor(user.id)
  const tabSet = new Set(tabs.map(it => it.id))

  const handleTabClick = (tabId: Tab) => {
    setTab(tabId)
    onMobileClose()
  }

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sb-head">
        <div className="sb-logo" role="img" aria-label="PontoGlass" />
        <span className="sb-brand">PontoGlass</span>
        <button
          className="sb-collapse"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir' : 'Recolher'}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-expanded={!collapsed}
        >
          <span style={{ display: 'flex', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <IconChevronsLeft size={14} />
          </span>
        </button>
      </div>

      <div className="sb-nav" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV_GROUPS.map(group => {
          const groupTabs = group.tabs.filter(id => tabSet.has(id))
          if (groupTabs.length === 0) return null
          return (
            <div key={group.key} className="sb-section">
              <div className="sb-section-label">{group.labels[lang]}</div>
              {groupTabs.map(tabId => {
                const count = badges[tabId] ?? 0
                return (
                  <button
                    key={tabId}
                    onClick={() => handleTabClick(tabId)}
                    className={`sb-item${tab === tabId ? ' active' : ''}`}
                    title={collapsed ? t(`tab.${tabId}` as Parameters<typeof t>[0]) : undefined}
                  >
                    <span className="sb-item-icon">{TAB_ICONS[tabId]}</span>
                    <span className="sb-item-label">
                      {t(`tab.${tabId}` as Parameters<typeof t>[0])}
                    </span>
                    {count > 0 && (
                      <span className="sb-item-badge" style={{
                        marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999,
                        background: 'var(--danger-fg)', color: '#fff',
                        fontSize: 10, fontWeight: 700, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                      }}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="sb-footer">
        <button className="sb-user" onClick={onOpenSettings} style={{ width: '100%', textAlign: 'left' }}>
          <div className={`avatar size-28 av-c${ci}`}>{avatarInitials(user.name)}</div>
          <div className="sb-user-meta">
            <div className="sb-user-name">{user.name}</div>
            <div className="sb-user-role">
              {/* Distinguish the platform controller from a company admin — the two
                  accounts are easy to mix up when they share a name (see #235). */}
              {user.super_admin
                ? t('auth.role.super_admin')
                : user.role === 'manager' ? t('auth.role.manager') : t('auth.role.admin')}
            </div>
          </div>
          <span style={{ color: 'var(--fg-subtle)', flexShrink: 0 }}>
            <IconSettings size={14} />
          </span>
        </button>
      </div>
    </aside>
  )
}
