'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import type { Employee, EmployeeProfile } from '@/lib/types'
import { Tab, ALL_TABS, MANAGER_TABS } from './_lib/types'
import Sidebar from './_components/Sidebar'
import TopBar from './_components/TopBar'
import CommandPalette from './_components/CommandPalette'
import SettingsModal from './_components/SettingsModal'
import MissingExitBanner from './_components/MissingExitBanner'
import { MeuPontoTab } from './_components/tabs/MeuPontoTab'
import { DashboardTab } from './_components/tabs/DashboardTab'
import { StatusTab } from './_components/tabs/StatusTab'
import { RegistrosTab } from './_components/tabs/RegistrosTab'
import { FuncionariosTab } from './_components/tabs/FuncionariosTab'
import { BancoHorasTab } from './_components/tabs/BancoHorasTab'
import { FeriadosTab } from './_components/tabs/FeriadosTab'
import { RelatoriosTab } from './_components/tabs/RelatoriosTab'
import { AuditoriaTab } from './_components/tabs/AuditoriaTab'
import { CorrecoesTab } from './_components/tabs/CorrecoesTab'
import { useNotifications } from './_lib/useNotifications'

export default function AdminPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showPwd, setShowPwd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCmdK, setShowCmdK] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pendingCorrections, setPendingCorrections] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const router = useRouter()

  const { items: notifItems } = useNotifications({ pendingCorrections, employees })

  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? MANAGER_TABS : ALL_TABS

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('pg.theme', next)
  }

  const toggleCollapse = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    document.documentElement.querySelector('.app')?.setAttribute('data-collapsed', String(next))
    localStorage.setItem('pg.sidebar-collapsed', String(next))
  }

  const endDeadSession = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* clear cookie anyway */ }
    router.replace('/login')
  }, [router])

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { await endDeadSession(); return }
      const data = await res.json()
      setUser(data)
      if (data.role === 'manager') setTab('meu_ponto')
    } catch { setFetchError(true) }
  }, [endDeadSession])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) setEmployees(await res.json())
    } catch { /* silent */ }
  }, [])

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/correction-requests?status=pending')
      if (res.ok) { const d = await res.json(); setPendingCorrections(d.length) }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('pg.theme')
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    const savedCollapsed = localStorage.getItem('pg.sidebar-collapsed') === 'true'
    if (savedCollapsed) {
      setSidebarCollapsed(true)
    }
    setFetchError(false)
    loadUser()
    loadEmployees()
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 60_000)
    return () => clearInterval(interval)
  }, [loadUser, loadEmployees, refreshPendingCount])

  // Sync data-collapsed attribute on app element
  useEffect(() => {
    const app = document.querySelector('.app')
    app?.setAttribute('data-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCmdK(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleCmdAction = (id: string) => {
    if (id === 'toggle_theme') toggleTheme()
    if (id === 'new_employee') setTab('funcionarios')
    if (id === 'export_csv') setTab('relatorios')
  }

  if (fetchError) return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 340 }}>
        <div style={{ color: 'var(--fg-muted)', marginBottom: 16 }}>Erro ao conectar. Verifique sua conexão.</div>
        <button onClick={() => { setFetchError(false); loadUser(); loadEmployees() }} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div className="tnum mono" style={{ fontSize: 32, color: 'var(--fg-dim)' }}>…</div>
    </div>
  )

  return (
    <div className="app" data-collapsed={sidebarCollapsed}>
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
      {showSettings && (
        <SettingsModal
          theme={theme}
          onToggleTheme={toggleTheme}
          onChangePwd={() => { setShowSettings(false); setShowPwd(true) }}
          onLogout={handleLogout}
          onClose={() => setShowSettings(false)}
        />
      )}
      <CommandPalette
        open={showCmdK}
        onClose={() => setShowCmdK(false)}
        tabs={visibleTabs}
        onNavigate={t => { setTab(t); setShowCmdK(false) }}
        onAction={handleCmdAction}
        theme={theme}
      />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        tab={tab}
        setTab={t => { setTab(t); if (t === 'correcoes') refreshPendingCount() }}
        tabs={visibleTabs}
        user={user}
        onOpenSettings={() => setShowSettings(true)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
        badges={{ correcoes: pendingCorrections }}
      />
      <div className="main">
        <TopBar
          tab={tab}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMobileNav={() => setSidebarOpen(true)}
          onOpenCmdK={() => setShowCmdK(true)}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen(v => !v)}
          onNavigate={t => { setTab(t); if (t === 'correcoes') refreshPendingCount() }}
          notifItems={notifItems}
        />
        <div className="page" id="main-content">
          <MissingExitBanner />
          {tab === 'meu_ponto'    && <MeuPontoTab user={user} />}
          {tab === 'dashboard'    && <DashboardTab employees={employees} />}
          {tab === 'status'       && <StatusTab employees={employees} currentUserId={user.id} />}
          {tab === 'registros'    && <RegistrosTab employees={employees} />}
          {tab === 'funcionarios' && <FuncionariosTab employees={employees} onRefresh={loadEmployees} />}
          {tab === 'banco'        && <BancoHorasTab employees={employees} />}
          {tab === 'feriados'     && <FeriadosTab />}
          {tab === 'relatorios'   && <RelatoriosTab employees={employees} />}
          {tab === 'correcoes'    && <CorrecoesTab onAction={refreshPendingCount} />}
          {tab === 'auditoria'    && user.role === 'admin' && <AuditoriaTab />}
        </div>
      </div>
    </div>
  )
}
