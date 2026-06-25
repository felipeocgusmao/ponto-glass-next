'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import type { Employee, EmployeeProfile } from '@/lib/types'
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
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showPwd, setShowPwd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCmdK, setShowCmdK] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [accent, setAccentState] = useState('indigo')
  const [font, setFontState] = useState('inter')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pendingCorrections, setPendingCorrections] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const router = useRouter()

  // The shared list now includes deactivated employees (for the Funcionários
  // trash bin); everything else operates on the active slice.
  const activeEmployees = useMemo(() => employees.filter(e => e.active !== false), [employees])

  const { items: notifItems } = useNotifications({ pendingCorrections, employees: activeEmployees })

  const isManager = user?.role === 'manager'
  // Super-admins (platform operators) get the extra "Empresas" tab.
  const visibleTabs = isManager
    ? MANAGER_TABS
    : (user?.super_admin ? [...ALL_TABS, ...SUPER_ADMIN_TABS] : ALL_TABS)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('pg.theme', next)
  }

  const changeAccent = (a: string) => {
    setAccentState(a)
    document.documentElement.setAttribute('data-accent', a)
    localStorage.setItem('pg.accent', a)
  }

  const changeFont = (f: string) => {
    setFontState(f)
    if (f === 'inter') document.documentElement.removeAttribute('data-font')
    else document.documentElement.setAttribute('data-font', f)
    localStorage.setItem('pg.font', f)
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

  // all=true brings deactivated employees too — the Funcionários tab shows
  // them under the "Inativos" filter with a restore action. Every other
  // consumer receives the active-only slice below.
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?all=true')
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
    const savedAccent = localStorage.getItem('pg.accent')
    if (savedAccent) { setAccentState(savedAccent); document.documentElement.setAttribute('data-accent', savedAccent) }
    const savedFont = localStorage.getItem('pg.font')
    if (savedFont) { setFontState(savedFont) }
    const savedCollapsed = localStorage.getItem('pg.sidebar-collapsed') === 'true'
    if (savedCollapsed) {
      setSidebarCollapsed(true)
    }
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
          accent={accent}
          font={font}
          onToggleTheme={toggleTheme}
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
