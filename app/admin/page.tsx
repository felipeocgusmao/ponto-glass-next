'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import type { EmployeeProfile } from '@/lib/types'
import { Tab, ALL_TABS, MANAGER_TABS, SUPER_ADMIN_TABS } from './_lib/types'
import Sidebar from './_components/Sidebar'
import TopBar from './_components/TopBar'
import CommandPalette from './_components/CommandPalette'
import SettingsModal from './_components/SettingsModal'
import MissingExitBanner from './_components/MissingExitBanner'
import { ErrorBoundary } from '@/app/_components/ErrorBoundary'
// Eagerly loaded — these are the default landing tabs for admin and manager roles.
import { MeuPontoTab } from './_components/tabs/MeuPontoTab'
import { DashboardTab } from './_components/tabs/DashboardTab'
import { useNotifications } from './_lib/useNotifications'
import { useThemeSettings } from '@/lib/hooks/useThemeSettings'
import { useEmployeeList } from './_lib/useEmployeeList'

function TabSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
      <div className="skeleton" style={{ height: 32, width: '40%' }} />
      <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-md)' }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 'var(--r-md)' }} />
    </div>
  )
}

// Lazily loaded — code is only fetched when the tab is first opened.
// RelatoriosTab bundles jspdf + jspdf-autotable (~300 KB) and RegistrosTab bundles
// xlsx (~200 KB); deferring them eliminates ~500 KB from the initial JS payload.
const StatusTab     = dynamic(() => import('./_components/tabs/StatusTab').then(m => ({ default: m.StatusTab })), { loading: TabSkeleton })
const RegistrosTab  = dynamic(() => import('./_components/tabs/RegistrosTab').then(m => ({ default: m.RegistrosTab })), { loading: TabSkeleton })
const FuncionariosTab = dynamic(() => import('./_components/tabs/FuncionariosTab').then(m => ({ default: m.FuncionariosTab })), { loading: TabSkeleton })
const BancoHorasTab = dynamic(() => import('./_components/tabs/BancoHorasTab').then(m => ({ default: m.BancoHorasTab })), { loading: TabSkeleton })
const FeriadosTab   = dynamic(() => import('./_components/tabs/FeriadosTab').then(m => ({ default: m.FeriadosTab })), { loading: TabSkeleton })
const RelatoriosTab = dynamic(() => import('./_components/tabs/RelatoriosTab').then(m => ({ default: m.RelatoriosTab })), { loading: TabSkeleton })
const AuditoriaTab  = dynamic(() => import('./_components/tabs/AuditoriaTab').then(m => ({ default: m.AuditoriaTab })), { loading: TabSkeleton })
const CorrecoesTab  = dynamic(() => import('./_components/tabs/CorrecoesTab').then(m => ({ default: m.CorrecoesTab })), { loading: TabSkeleton })
const EmpresasTab   = dynamic(() => import('./_components/tabs/EmpresasTab').then(m => ({ default: m.EmpresasTab })), { loading: TabSkeleton })
const AlertasTab    = dynamic(() => import('./_components/tabs/AlertasTab').then(m => ({ default: m.AlertasTab })), { loading: TabSkeleton })
const IntegracoesTab = dynamic(() => import('./_components/tabs/IntegracoesTab').then(m => ({ default: m.IntegracoesTab })), { loading: TabSkeleton })
const AusenciasTab   = dynamic(() => import('./_components/tabs/AusenciasTab').then(m => ({ default: m.AusenciasTab })), { loading: TabSkeleton })

export default function AdminPage() {
  const { theme, isSystemTheme, accent, font, selectTheme, toggleTheme, changeAccent, changeFont } = useThemeSettings()
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const { employees, activeEmployees, loadEmployees, setEmployees } = useEmployeeList()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showPwd, setShowPwd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCmdK, setShowCmdK] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pendingCorrections, setPendingCorrections] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const router = useRouter()

  const { items: notifItems } = useNotifications({ pendingCorrections, employees: activeEmployees })

  const isManager = user?.role === 'manager'
  // Super-admins (platform operators) get the extra "Empresas" tab.
  const visibleTabs = isManager
    ? MANAGER_TABS
    : (user?.super_admin ? [...ALL_TABS, ...SUPER_ADMIN_TABS] : ALL_TABS)

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

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/correction-requests?status=pending')
      if (res.ok) { const d = await res.json(); setPendingCorrections(d.length) }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('pg.sidebar-collapsed') === 'true'
    if (savedCollapsed) setSidebarCollapsed(true)
    setFetchError(false)
    loadUser()
    loadEmployees()
    refreshPendingCount()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshPendingCount()
    }, 60_000)
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

  const handleRevokeOtherSessions = async () => {
    await fetch('/api/auth/revoke-other-sessions', { method: 'POST' })
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
    <div className="app" data-collapsed="false">
      <div className="sidebar" style={{ position: 'fixed', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="sb-head"><div className="skeleton" style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0 }} /><div className="skeleton" style={{ width: 80, height: 13 }} /></div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[100, 80, 90, 70, 85].map((w, i) => <div key={i} className="skeleton" style={{ height: 28, width: `${w}%`, borderRadius: 6 }} />)}
        </div>
      </div>
      <div className="main">
        <div className="topbar"><div className="skeleton" style={{ width: 140, height: 14 }} /><div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} /><div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} /></div></div>
        <div className="page">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="skeleton" style={{ height: 28, width: '35%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 10 }} />)}
            </div>
            <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app" data-collapsed={sidebarCollapsed}>
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
      {showSettings && (
        <SettingsModal
          theme={theme}
          accent={accent}
          font={font}
          isSystemTheme={isSystemTheme}
          onSelectTheme={selectTheme}
          onChangeAccent={changeAccent}
          onChangeFont={changeFont}
          onChangePwd={() => { setShowSettings(false); setShowPwd(true) }}
          onLogout={handleLogout}
          onRevokeOtherSessions={handleRevokeOtherSessions}
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
          <ErrorBoundary>
            {tab === 'meu_ponto'    && <MeuPontoTab user={user} />}
            {tab === 'dashboard'    && <DashboardTab employees={activeEmployees} />}
            {tab === 'status'       && <StatusTab employees={activeEmployees} currentUserId={user.id} />}
            {tab === 'registros'    && <RegistrosTab employees={activeEmployees} />}
            {tab === 'funcionarios' && <FuncionariosTab employees={employees} onRefresh={loadEmployees} />}
            {tab === 'banco'        && <BancoHorasTab employees={activeEmployees} />}
            {tab === 'feriados'     && <FeriadosTab />}
            {tab === 'relatorios'   && <RelatoriosTab employees={activeEmployees} />}
            {tab === 'correcoes'    && <CorrecoesTab onAction={refreshPendingCount} />}
            {tab === 'ausencias'    && <AusenciasTab employees={activeEmployees} />}
            {tab === 'auditoria'    && user.role === 'admin' && <AuditoriaTab />}
            {tab === 'empresas'     && user.super_admin === true && <EmpresasTab />}
            {tab === 'alertas'      && user.role === 'admin' && <AlertasTab />}
            {tab === 'integracoes'  && user.role === 'admin' && <IntegracoesTab />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
