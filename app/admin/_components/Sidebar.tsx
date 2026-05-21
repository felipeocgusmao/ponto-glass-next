'use client'

import { avatarInitials } from '@/lib/utils'
import type { EmployeeProfile } from '@/lib/types'
import type { Tab } from '../_lib/types'
import { empColor } from '../_lib/helpers'
import { useLang, LANG_LABELS, type Lang } from '@/lib/LangContext'
import {
  IconClock, IconDashboard, IconStatus, IconList, IconUsers,
  IconBank, IconCalendar, IconBar, IconAudit, IconEdit,
  SunIcon, MoonIcon, LockSmIcon,
} from './icons'

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  meu_ponto:    <IconClock />,
  dashboard:    <IconDashboard />,
  status:       <IconStatus />,
  registros:    <IconList />,
  correcoes:    <IconEdit />,
  funcionarios: <IconUsers />,
  banco:        <IconBank />,
  feriados:     <IconCalendar />,
  relatorios:   <IconBar />,
  auditoria:    <IconAudit />,
}

const LANGS: Lang[] = ['pt-PT', 'pt-BR', 'en', 'es']

export default function Sidebar({ tab, setTab, tabs, user, onLogout, onChangePwd, theme, toggleTheme, mobileOpen, onMobileClose, badges = {} }: {
  tab: Tab; setTab: (t: Tab) => void
  tabs: { id: Tab; label: string }[]
  user: EmployeeProfile; onLogout: () => void; onChangePwd: () => void
  theme: string; toggleTheme: () => void
  mobileOpen: boolean; onMobileClose: () => void
  badges?: Partial<Record<Tab, number>>
}) {
  const { lang, setLang, t } = useLang()
  const ci = empColor(user.id)
  const handleTabClick = (tabId: Tab) => { setTab(tabId); onMobileClose() }

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sb-head">
        <img src="/icon-192.svg" width="28" height="28" alt="" style={{ borderRadius: 8, flexShrink: 0 }} />
        <span className="sb-brand">PontoGlass</span>
      </div>
      <nav className="sb-nav" style={{ padding: '8px' }}>
        {tabs.map(tabItem => {
          const count = badges[tabItem.id] ?? 0
          return (
            <button key={tabItem.id} onClick={() => handleTabClick(tabItem.id)} className={`sb-item${tab === tabItem.id ? ' active' : ''}`}>
              <span className="sb-item-icon">{TAB_ICONS[tabItem.id]}</span>
              <span className="sb-item-label">{t(`tab.${tabItem.id}` as Parameters<typeof t>[0])}</span>
              {count > 0 && (
                <span style={{
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
      </nav>
      <div className="sb-footer">
        <div className="sb-user">
          <div className={`avatar size-28 av-c${ci}`}>{avatarInitials(user.name)}</div>
          <div className="sb-user-meta">
            <div className="sb-user-name">{user.name}</div>
            <div className="sb-user-role">{user.role === 'manager' ? t('auth.role.manager') : 'Admin'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, padding: '0 2px', flexWrap: 'wrap' }}>
          <button onClick={toggleTheme} className="btn ghost sm icon" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={onChangePwd} className="btn ghost sm icon" title={t('auth.change_password')}>
            <LockSmIcon />
          </button>
          <button onClick={onLogout} className="btn ghost sm" style={{ flex: 1, justifyContent: 'center' }}>
            {t('common.logout')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6, padding: '0 2px' }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="btn ghost sm"
              style={{
                flex: 1, justifyContent: 'center', padding: '3px 0',
                fontSize: 10, fontWeight: lang === l ? 700 : 400,
                color: lang === l ? 'var(--accent)' : 'var(--fg-muted)',
                borderBottom: lang === l ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
              }}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
