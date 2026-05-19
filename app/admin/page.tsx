'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { avatarInitials, exportCSV, calcOvertimePeriod, calcHours, fmtMinutes, calcNetMinutes, calcTimeBreakdown, WORKING_TYPES } from '@/lib/utils'
import type { Employee, EmployeeProfile, PunchRecord } from '@/lib/types'

type Tab = 'status' | 'registros' | 'funcionarios' | 'relatorios'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'status',        label: 'Status'    },
  { id: 'registros',    label: 'Registros' },
  { id: 'funcionarios', label: 'Equipe'    },
  { id: 'relatorios',   label: 'Relatório' },
]

const MANAGER_TAB_IDS: Tab[] = ['status', 'registros', 'relatorios']

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
function IconStatus({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  status:       <IconStatus />,
  registros:    <IconList />,
  funcionarios: <IconUsers />,
  relatorios:   <IconBar />,
}

const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

// ─── Status tab ───────────────────────────────────────────────────────────────
function StatusTab({ employees, currentUserId }: { employees: Employee[]; currentUserId: string }) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const [punching, setPunching] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* keep current */ }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const iv = setInterval(() => setLiveMs(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const iv = setInterval(load, 60_000)
    return () => clearInterval(iv)
  }, [load])

  const handlePunch = async (emp: Employee, type: 'entrada' | 'saída') => {
    setPunching(emp.id)
    setMsg(null)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, employeeId: emp.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ id: emp.id, kind: 'success', text: type === 'entrada' ? '✅ Entrada registrada!' : '✅ Saída registrada!' })
        await load()
      } else {
        setMsg({ id: emp.id, kind: 'error', text: data.error ?? 'Erro ao registrar.' })
      }
    } catch {
      setMsg({ id: emp.id, kind: 'error', text: 'Erro de conexão.' })
    } finally {
      setPunching(null)
      setTimeout(() => setMsg(m => m?.id === emp.id ? null : m), 3_000)
    }
  }

  const recordsByEmp = new Map<string, PunchRecord[]>()
  records.forEach(r => {
    if (!recordsByEmp.has(r.employee_id)) recordsByEmp.set(r.employee_id, [])
    recordsByEmp.get(r.employee_id)!.push(r)
  })

  const workers = employees.filter(e => e.id !== currentUserId)

  const statuses = workers.map(emp => {
    const empRecords = recordsByEmp.get(emp.id) ?? []
    const sortedAsc = [...empRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastType = sortedAsc.at(-1)?.type
    const isWorking  = lastType != null && WORKING_TYPES.includes(lastType)
    const isOnLunch  = lastType === 'inicio_almoco'
    const isOnCafe   = lastType === 'pausa_cafe'
    const isIn       = isWorking || isOnLunch || isOnCafe

    const hasBreaks = empRecords.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
    let liveNetMin = 0
    if (hasBreaks) {
      const bd = calcTimeBreakdown(empRecords)
      const lastWorkStart = isWorking
        ? sortedAsc.slice().reverse().find(r => WORKING_TYPES.includes(r.type))
        : undefined
      const ongoingMin = lastWorkStart
        ? (liveMs - new Date(lastWorkStart.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, bd.workedMin + ongoingMin)
    } else {
      const lastEntry = isWorking
        ? sortedAsc.slice().reverse().find(r => r.type === 'entrada')
        : undefined
      const currentSessionMin = lastEntry
        ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, calcNetMinutes(empRecords, 0) + currentSessionMin - emp.lunch_break_minutes)
    }

    const liveEarnings = emp.hourly_rate && liveNetMin > 0
      ? ((liveNetMin / 60) * emp.hourly_rate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
      : null

    return { emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings }
  })

  const onlineCount   = statuses.filter(s => s.isIn).length
  const totalMinToday = statuses.reduce((sum, s) => sum + s.liveNetMin, 0)

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-box">
            <div className="metric-val text-green-300">{onlineCount}</div>
            <div className="metric-lbl">Em serviço agora</div>
          </div>
          <div className="metric-box">
            <div className="metric-val">{totalMinToday > 0 ? fmtMinutes(Math.round(totalMinToday)) : '—'}</div>
            <div className="metric-lbl">Horas hoje (total)</div>
          </div>
        </div>
      </div>

      <div className="glass p-5">
        <span className="section-label">{workers.length} funcionário(s)</span>
        {workers.length === 0 && (
          <div className="alert-info mt-2">Nenhum funcionário cadastrado.</div>
        )}
        {statuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings }) => (
          <div key={emp.id} className="worker-status-item">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="avatar-sm">{avatarInitials(emp.name)}</div>
                <span className={`status-dot ${isWorking ? 'status-dot-in' : (isOnLunch || isOnCafe) ? 'status-dot-break' : 'status-dot-out'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white text-sm truncate">{emp.name}</div>
                <div className="text-xs mt-0.5">
                  {isWorking
                    ? <span className="text-green-400">● Em serviço · {liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '< 1min'}</span>
                    : isOnLunch
                    ? <span className="text-yellow-300">🍽 No almoço</span>
                    : isOnCafe
                    ? <span className="text-yellow-300">☕ Pausa café</span>
                    : <span className="text-white/40">{liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) + ' hoje' : 'Sem registro hoje'}</span>
                  }
                </div>
                {liveEarnings && (
                  <div className="text-xs text-green-300/70 mt-0.5">{liveEarnings} hoje</div>
                )}
                {msg?.id === emp.id && (
                  <div className={`text-xs mt-1 ${msg.kind === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => handlePunch(emp, isIn ? 'saída' : 'entrada')}
              disabled={punching === emp.id}
              className={isIn ? 'punch-mini-out' : 'punch-mini-in'}
            >
              {punching === emp.id ? '...' : isIn ? '⏹ Saída' : '▶ Entrada'}
            </button>
          </div>
        ))}
      </div>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (empId !== 'all') params.set('employeeId', empId)
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setRecords(await res.json())
      else { const d = await res.json(); setError(d.error ?? 'Erro ao carregar registros.') }
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [from, to, empId])

  useEffect(() => { load() }, [load])

  return (
    <div className="tab-content space-y-4">
      {/* Filters */}
      <div className="glass p-5 space-y-3">
        <span className="section-label">Filtros</span>

        <div className="date-range">
          <div className="date-range-col">
            <label className="input-label">De</label>
            <input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} />
          </div>
          <div className="date-range-sep" />
          <div className="date-range-col">
            <label className="input-label">Até</label>
            <input type="date" value={to} onChange={(e) => handleToChange(e.target.value)} />
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
        {error && <div className="alert-error mb-3">{error}</div>}
        {loading
          ? <div className="alert-info">Carregando...</div>
          : records.length === 0
            ? <div className="alert-info">Nenhum registro para este filtro.</div>
            : (
              <>
                <span className="section-label">{records.length} registro(s)</span>
                {records.map((r) => {
                  const tagClass = r.type === 'entrada' ? 'rec-tag-in' : r.type === 'saída' ? 'rec-tag-out' : 'rec-tag-break'
                  const tagLabel: Record<string, string> = {
                    entrada: 'Entrada', saída: 'Saída',
                    inicio_almoco: 'Almoço', fim_almoco: 'Ret. Almoço',
                    pausa_cafe: 'Café', retorno_cafe: 'Ret. Café',
                  }
                  return (
                    <div key={r.id} className="record-item">
                      <div>
                        <div className="font-semibold text-white text-sm">{r.employee_name}</div>
                        <div className="text-white/35 text-xs mt-1">
                          {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {' · '}
                          {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                      <span className={tagClass}>{tagLabel[r.type] ?? r.type}</span>
                    </div>
                  )
                })}
              </>
            )
        }
      </div>
    </div>
  )
}

// ─── Funcionários tab ─────────────────────────────────────────────────────────
function EmployeeSettings({ emp, onDone }: { emp: Employee; onDone: () => void }) {
  const [username, setUsername] = useState(emp.username)
  const [workdayHours, setWorkdayHours] = useState(String(emp.workday_hours))
  const [lunchMin, setLunchMin] = useState(String(emp.lunch_break_minutes))
  const [rate, setRate] = useState(emp.hourly_rate != null ? String(emp.hourly_rate) : '')
  const [newPassword, setNewPassword] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true); setErr(''); setOk('')
    const body: Record<string, unknown> = {
      workday_hours: workdayHours,
      lunch_break_minutes: lunchMin,
      hourly_rate: rate,
    }
    if (username !== emp.username) body.username = username
    if (newPassword) body.new_password = newPassword

    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao salvar.'); setSaving(false); return }
    setOk(newPassword ? 'Configurações e senha atualizadas!' : 'Configurações salvas!')
    setNewPassword('')
    setSaving(false)
    setTimeout(() => onDone(), 1200)
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
      <div>
        <label className="input-label">Nome de usuário</label>
        <input
          value={username} onChange={(e) => setUsername(e.target.value)}
          placeholder="ex: maria.silva" className="glass-input"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="input-label">Jornada</label>
          <select value={workdayHours} onChange={(e) => setWorkdayHours(e.target.value)} className="glass-select">
            {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Almoço</label>
          <select value={lunchMin} onChange={(e) => setLunchMin(e.target.value)} className="glass-select">
            <option value="0">Sem desconto</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        <div>
          <label className="input-label">€/hora</label>
          <input
            type="number" min="0" step="0.01"
            value={rate} onChange={(e) => setRate(e.target.value)}
            placeholder="0,00" className="glass-input"
          />
        </div>
      </div>
      <div>
        <label className="input-label">Nova senha (deixe em branco para não alterar)</label>
        <input
          type="password"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mín. 6 caracteres" className="glass-input"
        />
      </div>
      {err && <div className="alert-error">{err}</div>}
      {ok && <div className="alert-success">{ok}</div>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-glass flex-1">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onDone} className="btn-danger">Cancelar</button>
      </div>
    </div>
  )
}

function FuncionariosTab({ employees, onRefresh }: { employees: Employee[]; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>('employee')
  const [workdayHours, setWorkdayHours] = useState('8')
  const [lunchMin, setLunchMin] = useState('60')
  const [rate, setRate] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setOk(''); setLoading(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, username, password, role,
        workday_hours: workdayHours,
        lunch_break_minutes: lunchMin,
        hourly_rate: rate || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(`${name} adicionado!`)
    setName(''); setUsername(''); setPassword(''); setRole('employee')
    setWorkdayHours('8'); setLunchMin('60'); setRate('')
    setLoading(false)
    onRefresh()
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(`Desativar ${empName}?`)) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setErr(data.error ?? 'Erro ao remover funcionário.')
      return
    }
    onRefresh()
  }

  return (
    <div className="tab-content space-y-4">
      {/* Employee list */}
      <div className="glass p-5">
        <span className="section-label">{employees.length} ativo(s)</span>
        {err && <div className="alert-error mb-3">{err}</div>}
        {employees.map((emp) => (
          <div key={emp.id} className="py-2 border-b border-white/5 last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="avatar-sm">{avatarInitials(emp.name)}</div>
                <div>
                  <div className="font-semibold text-white text-sm">
                    {emp.name}
                    {emp.role === 'admin' && <span className="admin-badge ml-2">Admin</span>}
                    {emp.role === 'manager' && <span className="admin-badge ml-2">Gerente</span>}
                  </div>
                  <div className="text-white/35 text-xs mt-0.5">
                    @{emp.username} · {emp.workday_hours}h ·{' '}
                    {emp.lunch_break_minutes > 0 ? `${emp.lunch_break_minutes}min almoço` : 'sem desconto'}
                    {emp.hourly_rate != null && ` · €${Number(emp.hourly_rate).toFixed(2)}/h`}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(editingId === emp.id ? null : emp.id)}
                  className="btn-settings text-xs px-2"
                  title="Configurações"
                >⚙</button>
                {emp.username !== 'admin' && (
                  <button onClick={() => handleRemove(emp.id, emp.name)} className="btn-danger">
                    Remover
                  </button>
                )}
              </div>
            </div>
            {editingId === emp.id && (
              <EmployeeSettings
                emp={emp}
                onDone={() => { setEditingId(null); onRefresh() }}
              />
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
              <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="glass-select">
                <option value="employee">Funcionário</option>
                <option value="manager">Gerente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Jornada</label>
              <select value={workdayHours} onChange={(e) => setWorkdayHours(e.target.value)} className="glass-select">
                {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Almoço</label>
              <select value={lunchMin} onChange={(e) => setLunchMin(e.target.value)} className="glass-select">
                <option value="0">Sem desconto</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
              </select>
            </div>
            <div>
              <label className="input-label">€/hora</label>
              <input
                type="number" min="0" step="0.01"
                value={rate} onChange={(e) => setRate(e.target.value)}
                placeholder="Opcional" className="glass-input"
              />
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
function RelatoriosTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }

  const load = async () => {
    setError(''); setTruncated(false); setLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`)
      if (res.ok) {
        setRecords(await res.json())
        setLoaded(true)
        setTruncated(res.headers.get('X-Truncated') === 'true')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erro ao gerar relatório.')
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const byEmp: Record<string, { name: string; records: PunchRecord[] }> = {}
  records.forEach((r) => {
    if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { name: r.employee_name, records: [] }
    byEmp[r.employee_id].records.push(r)
  })

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5 space-y-3">
        <span className="section-label">Período</span>

        <div className="date-range">
          <div className="date-range-col">
            <label className="input-label">De</label>
            <input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} />
          </div>
          <div className="date-range-sep" />
          <div className="date-range-col">
            <label className="input-label">Até</label>
            <input type="date" value={to} onChange={(e) => handleToChange(e.target.value)} />
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}
        <button onClick={load} disabled={loading} className="btn-glass w-full">
          {loading ? 'Gerando...' : 'Gerar Relatório'}
        </button>
      </div>

      {loaded && !loading && (
        <div className="glass p-5">
          {truncated && (
            <div className="alert-error mb-3">
              Resultado limitado a 2000 registros. Refine o período para ver todos os dados.
            </div>
          )}
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
                  onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`, employees.map(e => ({ id: e.id, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })))}
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
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('status')
  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? ALL_TABS.filter(t => MANAGER_TAB_IDS.includes(t.id)) : ALL_TABS
  const [showPwd, setShowPwd] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const router = useRouter()

  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? ALL_TABS.filter(t => MANAGER_TAB_IDS.includes(t.id)) : ALL_TABS

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
    } catch {
      setFetchError(true)
    }
  }, [router])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) setEmployees(await res.json())
    } catch { /* employees ficam como estão */ }
  }, [])

  useEffect(() => {
    setFetchError(false)
    loadUser()
    loadEmployees()
  }, [loadUser, loadEmployees])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (fetchError) return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="glass p-8 text-center max-w-sm w-full">
        <div className="text-white/50 mb-4">Erro ao conectar. Verifique sua conexão.</div>
        <button onClick={() => { setFetchError(false); loadUser(); loadEmployees() }} className="btn-glass w-full">
          Tentar novamente
        </button>
      </div>
    </main>
  )

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="clock-time opacity-30">...</div>
    </main>
  )

  return (
    <main className="min-h-screen p-4 md:p-8 page-pad-nav">
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}

      <div className="max-w-xl md:max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="avatar">{avatarInitials(user.name)}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">{user.name}</span>
                <span className="admin-badge">{isManager ? 'Gerente' : 'Admin'}</span>
              </div>
              <div className="text-white/35 text-xs mt-0.5">{isManager ? 'Painel de Gestão' : 'Painel Administrativo'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPwd(true)} className="btn-settings" title="Trocar senha">⚙</button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>

        {/* Desktop tab navigation — hidden on mobile */}
        <div className="hidden md:flex tab-list mb-6">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab flex items-center gap-2 ${tab === t.id ? 'tab-active' : ''}`}
            >
              <span className="opacity-70">{TAB_ICONS[t.id]}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div key={tab}>
          {tab === 'status'       && <StatusTab employees={employees} currentUserId={user.id} />}
          {tab === 'registros'    && <RegistrosTab employees={employees} />}
          {tab === 'funcionarios' && <FuncionariosTab employees={employees} onRefresh={loadEmployees} />}
          {tab === 'relatorios'   && <RelatoriosTab employees={employees} />}
        </div>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className="bottom-nav md:hidden">
        {visibleTabs.map((t) => (
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
