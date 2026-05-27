'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import type { Employee, EmployeeProfile } from '@/lib/types'
import { Tab, ALL_TABS, MANAGER_TABS } from './_lib/types'
import { IconHamburger } from './_components/icons'
import Sidebar from './_components/Sidebar'
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

export default function AdminPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showPwd, setShowPwd] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCorrections, setPendingCorrections] = useState(0)
  const router = useRouter()

  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? MANAGER_TABS : ALL_TABS

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('pg.theme', next)
  }

  // A token can stay validly *signed* (so the edge middleware bounces /login back to a
  // protected page) while the API rejects it — e.g. the session was revoked via
  // sessions_valid_from. Clearing the cookie through logout makes /login reachable again,
  // instead of looping forever on the loading splash.
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
    } catch { /* employees ficam como estão */ }
  }, [])

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/correction-requests?status=pending')
      if (res.ok) { const d = await res.json(); setPendingCorrections(d.length) }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('pg.theme')
    if (saved) setTheme(saved)
    setFetchError(false)
    loadUser()
    loadEmployees()
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 60_000)
    return () => clearInterval(interval)
  }, [loadUser, loadEmployees, refreshPendingCount])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
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
    <div className="app">
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        tab={tab} setTab={t => { setTab(t); if (t === 'correcoes') refreshPendingCount() }} tabs={visibleTabs}
        user={user} onLogout={handleLogout} onChangePwd={() => setShowPwd(true)}
        theme={theme} toggleTheme={toggleTheme}
        mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)}
        badges={{ correcoes: pendingCorrections }}
      />
      <div className="main">
        <header className="topbar">
          <button onClick={() => setSidebarOpen(true)} className="topbar-hamburger" aria-label="Abrir menu">
            <IconHamburger />
          </button>
          <div className="breadcrumbs">
            <span className="crumb current">{visibleTabs.find(t => t.id === tab)?.label ?? ''}</span>
          </div>
        </header>
        <div className="page">
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
