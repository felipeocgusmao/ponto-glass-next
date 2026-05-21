'use client'

import { avatarInitials } from '@/lib/utils'
import type { EmployeeProfile } from '@/lib/types'
import type { Tab } from '../_lib/types'
import { empColor } from '../_lib/helpers'
import {
  IconClock, IconDashboard, IconStatus, IconList, IconUsers,
  IconBank, IconCalendar, IconBar, IconAudit,
  SunIcon, MoonIcon, LockSmIcon,
} from './icons'

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  meu_ponto:    <IconClock />,
  dashboard:    <IconDashboard />,
  status:       <IconStatus />,
  registros:    <IconList />,
  funcionarios: <IconUsers />,
  banco:        <IconBank />,
  feriados:     <IconCalendar />,
  relatorios:   <IconBar />,
  auditoria:    <IconAudit />,
}

export default function Sidebar({ tab, setTab, tabs, user, onLogout, onChangePwd, theme, toggleTheme, mobileOpen, onMobileClose }: {
  tab: Tab; setTab: (t: Tab) => void
  tabs: { id: Tab; label: string }[]
  user: EmployeeProfile; onLogout: () => void; onChangePwd: () => void
  theme: string; toggleTheme: () => void
  mobileOpen: boolean; onMobileClose: () => void
}) {
  const ci = empColor(user.id)
  const handleTabClick = (t: Tab) => { setTab(t); onMobileClose() }
  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sb-head">
        <img src="/icon-192.svg" width="28" height="28" alt="" style={{ borderRadius: 8, flexShrink: 0 }} />
        <span className="sb-brand">PontoGlass</span>
      </div>
      <nav className="sb-nav" style={{ padding: '8px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => handleTabClick(t.id)} className={`sb-item${tab === t.id ? ' active' : ''}`}>
            <span className="sb-item-icon">{TAB_ICONS[t.id]}</span>
            <span className="sb-item-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="sb-footer">
        <div className="sb-user">
          <div className={`avatar size-28 av-c${ci}`}>{avatarInitials(user.name)}</div>
          <div className="sb-user-meta">
            <div className="sb-user-name">{user.name}</div>
            <div className="sb-user-role">{user.role === 'manager' ? 'Gerente' : 'Admin'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: '0 2px' }}>
          <button onClick={toggleTheme} className="btn ghost sm icon" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={onChangePwd} className="btn ghost sm icon" title="Trocar senha">
            <LockSmIcon />
          </button>
          <button onClick={onLogout} className="btn ghost sm" style={{ flex: 1, justifyContent: 'center' }}>
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
