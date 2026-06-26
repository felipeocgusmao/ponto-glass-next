'use client'

import { useRef } from 'react'
import { avatarInitials, empColor } from '@/lib/utils'
import type { EmployeeProfile } from '@/lib/types'
import { useLang } from '@/lib/LangContext'
import { IconChevronsLeft, IconSettings } from '@/app/admin/_components/icons'

type Tab = 'ponto' | 'historico' | 'banco' | 'correcoes' | 'perfil'

function ClockIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> }
function HistoryIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function BankIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg> }
function EditIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function UserIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  ponto:     <ClockIcon />,
  historico: <HistoryIcon />,
  banco:     <BankIcon />,
  correcoes: <EditIcon />,
  perfil:    <UserIcon />,
}

type TabLabelKey = 'tab.meu_ponto' | 'tab.registros' | 'tab.banco' | 'tab.correcoes' | 'tab.perfil'

const TAB_LABEL_KEYS: Record<Tab, TabLabelKey> = {
  ponto:     'tab.meu_ponto',
  historico: 'tab.registros',
  banco:     'tab.banco',
  correcoes: 'tab.correcoes',
  perfil:    'tab.perfil',
}

const TABS: Tab[] = ['ponto', 'historico', 'banco', 'correcoes', 'perfil']

export default function EmpSidebar({
  tab, setTab, user, onOpenSettings,
  mobileOpen, onMobileClose, collapsed, onToggleCollapse,
  badges = {},
}: {
  tab: Tab
  setTab: (t: Tab) => void
  user: EmployeeProfile
  onOpenSettings: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  badges?: Partial<Record<Tab, number>>
}) {
  const { t } = useLang()
  const ci = empColor(user.id)
  const navRef = useRef<HTMLDivElement>(null)

  const handleNavKeyDown = (e: React.KeyboardEvent, tabId: Tab) => {
    const idx = TABS.indexOf(tabId)
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = TABS[(idx + 1) % TABS.length]
      setTab(next)
      navRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = TABS[(idx - 1 + TABS.length) % TABS.length]
      setTab(prev)
      navRef.current?.querySelector<HTMLElement>(`[data-tab="${prev}"]`)?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setTab(TABS[0])
      navRef.current?.querySelector<HTMLElement>(`[data-tab="${TABS[0]}"]`)?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setTab(TABS[TABS.length - 1])
      navRef.current?.querySelector<HTMLElement>(`[data-tab="${TABS[TABS.length - 1]}"]`)?.focus()
    }
  }

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sb-head">
        <div className="sb-logo" role="img" aria-label="PontoGlass" />
        <span className="sb-brand">PontoGlass</span>
        {mobileOpen ? (
          <button
            className="sb-collapse"
            onClick={onMobileClose}
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <span style={{ display: 'flex', fontSize: 16, lineHeight: 1, fontWeight: 300 }}>×</span>
          </button>
        ) : (
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
        )}
      </div>

      <div ref={navRef} className="sb-nav" role="tablist" aria-label="Navegação" aria-orientation="vertical" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {TABS.map(tabId => {
          const count = badges[tabId] ?? 0
          const isActive = tab === tabId
          return (
            <button
              key={tabId}
              data-tab={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tabId}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => { setTab(tabId); onMobileClose() }}
              onKeyDown={e => handleNavKeyDown(e, tabId)}
              className={`sb-item${isActive ? ' active' : ''}`}
              title={collapsed ? t(TAB_LABEL_KEYS[tabId]) : undefined}
            >
              <span className="sb-item-icon">{TAB_ICONS[tabId]}</span>
              <span className="sb-item-label">{t(TAB_LABEL_KEYS[tabId])}</span>
              {count > 0 && (
                <span className="sb-item-badge" aria-label={`${count} notificação${count !== 1 ? 'ões' : ''}`} style={{
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

      <div className="sb-footer">
        <button className="sb-user" onClick={onOpenSettings} style={{ width: '100%', textAlign: 'left' }}>
          <div className={`avatar size-28 av-c${ci}`}>{avatarInitials(user.name)}</div>
          <div className="sb-user-meta">
            <div className="sb-user-name">{user.name.split(' ').slice(0, 2).join(' ')}</div>
            <div className="sb-user-role">@{user.username}</div>
          </div>
          <span style={{ color: 'var(--fg-subtle)', flexShrink: 0 }}>
            <IconSettings size={14} />
          </span>
        </button>
      </div>
    </aside>
  )
}
