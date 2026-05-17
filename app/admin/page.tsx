'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LiveClock from '@/components/LiveClock'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { calcHours, avatarInitials, exportCSV, calcOvertimeToday, calcOvertimePeriod, fmtMinutes } from '@/lib/utils'
import type { Employee, JWTUser, PunchRecord } from '@/lib/types'

type Tab = 'ponto' | 'registros' | 'funcionarios' | 'relatorios'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ponto',        label: 'Ponto'     },
  { id: 'registros',    label: 'Registros' },
  { id: 'funcionarios', label: 'Equipe'    },
  { id: 'relatorios',   label: 'Relatório' },
]

function IconClock({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5"/>
      <polyline points="12 7 12 12 15.5 14.5"/>
    </svg>
  )
}
function IconList({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3.5" cy="6"  r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="18" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IconUsers({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconBar({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  ponto:        <IconClock />,
  registros:    <IconList />,
  funcionarios: <IconUsers />,
  relatorios:   <IconBar />,
}

// ─── Punch card (Meu Ponto tab) ───────────────────────────────────────────────
function PunchCard({ user }: { user: JWTUser }) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/records?today=true')
    if (res.ok) setRecords(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const handlePunch = async (type: 'entrada' | 'saída') => {
    setLoading(true); setMsg(null)
    const res = await fetch('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    setMsg(res.ok
      ? { kind: 'success', text: type === 'entrada' ? '✅ Entrada registrada!' : '✅ Saída registrada!' }
      : { kind: 'error', text: 'Erro ao registrar.' }
    )
    if (res.ok) await load()
    setLoading(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const isInside = sorted[0]?.type === 'entrada'
  const overtime = calcOvertimeToday(records)

  return (
    <div className="tab-content space-y-4">
      {/* Clock + punch */}
      <div className="glass p-8">
        <LiveClock />
        <div className="text-center my-5">
          <span className={isInside ? 'status-in' : 'status-out'}>
            {isInside ? '● Você está dentro' : '● Você está fora'}
          </span>
        </div>
        {msg && (
          <div className={`mb-4 ${msg.kind === 'success' ? 'alert-success' : 'alert-error'}`}>
            {msg.text}
          </div>
        )}
        <button
          onClick={() => handlePunch(isInside ? 'saída' : 'entrada')}
          disabled={loading}
          className={`w-full ${isInside ? 'btn-saida' : 'btn-entrada'}`}
        >
          {loading ? '...' : isInside ? '⏹  Registrar Saída' : '▶  Registrar Entrada'}
        </button>
      </div>

      {/* Metrics + history */}
      {records.length > 0 && (
        <div className="glass p-6">
          <div className={`grid gap-3 mb-6 ${overtime !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="metric-box">
              <div className="metric-val">{calcHours(records)}</div>
              <div className="metric-lbl">Horas hoje</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">{records.length}</div>
              <div className="metric-lbl">Registros</div>
            </div>
            {overtime !== null && (
              <div className="metric-box">
                <div className={`metric-val text-xl ${overtime >= 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                  {overtime >= 0 ? '+' : '-'}{fmtMinutes(overtime)}
                </div>
                <div className="metric-lbl">{overtime >= 0 ? 'Extra' : 'A cumprir'}</div>
              </div>
            )}
          </div>

          <span className="section-label">Hoje</span>
          {sorted.map((r) => (
            <div key={r.id} className="record-item">
              <span className="font-semibold text-white text-sm">
                {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className={r.type === 'entrada' ? 'rec-tag-in' : 'rec-tag-out'}>
                {r.type === 'entrada' ? 'Entrada' : 'Saída'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Registros tab ────────────────────────────────────────────────────────────
function RegistrosTab({ employees }: { employees: Employee[] }) {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [empId, setEmpId] = useState('all')
  const [records, setRecords] = useState<PunchRecord[]>([])

  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to })
    if (empId !== 'all') params.set('employeeId', empId)
    const res = await fetch(`/api/reports?${params}`)
    if (res.ok) setRecords(await res.json())
  }, [from, to, empId])

  useEffect(() => { load() }, [load])

  return (
    <div className="tab-content space-y-4">
      {/* Filters */}
      <div className="glass p-5 space-y-4">
        <span className="section-label">Filtros</span>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass-input" />
          </div>
          <div>
            <label className="input-label">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass-input" />
          </div>
        </div>

        <div>
          <label className="input-label">Funcionário</label>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="glass-select">
            <option value="all">Todos</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="glass p-5">
        {records.length === 0
          ? <div className="alert-info">Nenhum registro para este filtro.</div>
          : (
            <>
              <span className="section-label">{records.length} registro(s)</span>
              {records.map((r) => (
                <div key={r.id} className="record-item">
                  <div>
                    <div className="font-semibold text-white text-sm">{r.employee_name}</div>
                    <div className="text-white/35 text-xs mt-1">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      {' · '}
                      {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                  <span className={r.type === 'entrada' ? 'rec-tag-in' : 'rec-tag-out'}>
                    {r.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </div>
              ))}
            </>
          )
        }
      </div>
    </div>
  )
}

// ─── Funcionários tab ─────────────────────────────────────────────────────────
function FuncionariosTab({ employees, onRefresh }: { employees: Employee[]; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'employee' | 'admin'>('employee')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setOk(''); setLoading(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, role }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(`${name} adicionado!`)
    setName(''); setUsername(''); setPassword(''); setRole('employee')
    setLoading(false)
    onRefresh()
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(`Desativar ${empName}?`)) return
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="tab-content space-y-4">
      {/* Employee list */}
      <div className="glass p-5">
        <span className="section-label">{employees.length} ativo(s)</span>
        {employees.map((emp) => (
          <div key={emp.id} className="record-item">
            <div className="flex items-center gap-3">
              <div className="avatar-sm">{avatarInitials(emp.name)}</div>
              <div>
                <div className="font-semibold text-white text-sm">
                  {emp.name}
                  {emp.role === 'admin' && <span className="admin-badge ml-2">Admin</span>}
                </div>
                <div className="text-white/35 text-xs mt-0.5">@{emp.username}</div>
              </div>
            </div>
            {emp.username !== 'admin' && (
              <button onClick={() => handleRemove(emp.id, emp.name)} className="btn-danger">
                Remover
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="glass p-5">
        <span className="section-label">Novo funcionário</span>
        <form onSubmit={handleAdd} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" className="glass-input" required />
            </div>
            <div>
              <label className="input-label">Usuário</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="maria.silva" className="glass-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 6 chars" className="glass-input" required />
            </div>
            <div>
              <label className="input-label">Perfil</label>
              <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')} className="glass-select">
                <option value="employee">Funcionário</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {err && <div className="alert-error">{err}</div>}
          {ok && <div className="alert-success">{ok}</div>}
          <button type="submit" disabled={loading} className="btn-glass w-full">
            {loading ? 'Adicionando...' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Relatórios tab ───────────────────────────────────────────────────────────
function RelatoriosTab() {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/reports?from=${from}&to=${to}`)
    if (res.ok) { setRecords(await res.json()); setLoaded(true) }
  }

  const byEmp: Record<string, { name: string; records: PunchRecord[] }> = {}
  records.forEach((r) => {
    if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { name: r.employee_name, records: [] }
    byEmp[r.employee_id].records.push(r)
  })

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5 space-y-4">
        <span className="section-label">Período</span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass-input" />
          </div>
          <div>
            <label className="input-label">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass-input" />
          </div>
        </div>
        <button onClick={load} className="btn-glass w-full">Gerar Relatório</button>
      </div>

      {loaded && (
        <div className="glass p-5">
          {records.length === 0
            ? <div className="alert-info">Nenhum registro no período.</div>
            : (
              <>
                <span className="section-label">
                  {Object.keys(byEmp).length} pessoa(s) · {records.length} registros
                </span>

                {Object.values(byEmp).map(({ name, records: recs }) => {
                  const overtime = calcOvertimePeriod(recs)
                  return (
                    <div key={name} className="record-item">
                      <div>
                        <div className="font-semibold text-white text-sm">{name}</div>
                        <div className="text-white/35 text-xs mt-0.5">{recs.length} registros</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="font-bold text-white text-sm">{calcHours(recs)}</div>
                        {overtime !== null && (
                          <span className={overtime >= 0 ? 'overtime-pos' : 'overtime-neg'}>
                            {overtime >= 0 ? '+' : '-'}{fmtMinutes(overtime)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className="glass-divider" />
                <button
                  onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`)}
                  className="btn-purple w-full"
                >
                  ⬇  Exportar CSV
                </button>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── Admin page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState<JWTUser | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('ponto')
  const [showPwd, setShowPwd] = useState(false)
  const router = useRouter()

  const loadUser = useCallback(async () => {
    const res = await fetch('/api/me')
    if (!res.ok) { router.push('/login'); return }
    setUser(await res.json())
  }, [router])

  const loadEmployees = useCallback(async () => {
    const res = await fetch('/api/employees')
    if (res.ok) setEmployees(await res.json())
  }, [])

  useEffect(() => { loadUser(); loadEmployees() }, [loadUser, loadEmployees])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="clock-time opacity-30">...</div>
    </main>
  )

  return (
    <main className="min-h-screen p-4 md:p-8 page-pad-nav">
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}

      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="avatar">{avatarInitials(user.name)}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">{user.name}</span>
                <span className="admin-badge">Admin</span>
              </div>
              <div className="text-white/35 text-xs mt-0.5">Painel Administrativo</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPwd(true)} className="btn-settings" title="Trocar senha">⚙</button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>

        {/* Tab content */}
        <div key={tab}>
          {tab === 'ponto'        && <PunchCard user={user} />}
          {tab === 'registros'    && <RegistrosTab employees={employees} />}
          {tab === 'funcionarios' && <FuncionariosTab employees={employees} onRefresh={loadEmployees} />}
          {tab === 'relatorios'   && <RelatoriosTab />}
        </div>
      </div>

      {/* Bottom navigation — liquid glass pill */}
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`nav-item ${tab === t.id ? 'nav-item-active' : ''}`}
          >
            <span className="nav-icon">{TAB_ICONS[t.id]}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}
