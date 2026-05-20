'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import PunchCard from '@/components/PunchCard'
import { avatarInitials, exportCSV, calcOvertimePeriod, calcHours, fmtMinutes, calcNetMinutes, calcTimeBreakdown, WORKING_TYPES } from '@/lib/utils'
import type { Employee, EmployeeProfile, PunchRecord, AuditLog, HourBankAdjustment, DayException } from '@/lib/types'

type Tab = 'meu_ponto' | 'status' | 'registros' | 'funcionarios' | 'relatorios' | 'dashboard' | 'auditoria' | 'banco' | 'feriados'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'status',       label: 'Status'    },
  { id: 'registros',   label: 'Registros' },
  { id: 'funcionarios', label: 'Equipe'    },
  { id: 'banco',        label: 'Banco'     },
  { id: 'feriados',     label: 'Feriados'  },
  { id: 'relatorios',  label: 'Relatório' },
  { id: 'auditoria',   label: 'Auditoria' },
]

const MANAGER_TABS: { id: Tab; label: string }[] = [
  { id: 'meu_ponto',  label: 'Meu Ponto' },
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'status',     label: 'Status'    },
  { id: 'registros',  label: 'Registros' },
  { id: 'banco',      label: 'Banco'     },
  { id: 'feriados',   label: 'Feriados'  },
  { id: 'relatorios', label: 'Relatório' },
]

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

function IconClock({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  )
}
function IconDashboard({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v9H3z"/><path d="M14 3h7v5h-7z"/><path d="M14 12h7v9h-7z"/><path d="M3 16h7v5H3z"/>
    </svg>
  )
}
function IconAudit({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function IconBank({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  )
}
function IconCalendar({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  )
}

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

const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

// ─── Status tab ───────────────────────────────────────────────────────────────
function StatusTab({ employees, currentUserId }: { employees: Employee[]; currentUserId: string }) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const [punching, setPunching] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; kind: 'success' | 'error'; text: string } | null>(null)
  const [weekRecords, setWeekRecords] = useState<PunchRecord[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* keep current */ }
  }, [])

  const loadWeek = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const day = now.getDay()
    const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (fmt(yesterday) < fmt(monday)) return
    try {
      const res = await fetch(`/api/reports?from=${fmt(monday)}&to=${fmt(yesterday)}`)
      if (res.ok) setWeekRecords(await res.json())
    } catch { /* keep current */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadWeek() }, [loadWeek])

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

  const weekByEmp = new Map<string, PunchRecord[]>()
  weekRecords.forEach(r => {
    if (!weekByEmp.has(r.employee_id)) weekByEmp.set(r.employee_id, [])
    weekByEmp.get(r.employee_id)!.push(r)
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

    const pastWeekRecs = weekByEmp.get(emp.id) ?? []
    const pastWeekMin = pastWeekRecs.length > 0 ? (calcOvertimePeriod(pastWeekRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
    const weekTotal = Math.round(pastWeekMin + liveNetMin)

    return { emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal }
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
        {statuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal }) => (
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
                {weekTotal > 0 && (
                  <div className="text-xs text-white/30 mt-0.5">{fmtMinutes(weekTotal)} esta semana</div>
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
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newEmpId, setNewEmpId] = useState('')
  const [newType, setNewType] = useState('entrada')
  const [newTs, setNewTs] = useState('')
  const [newSaving, setNewSaving] = useState(false)
  const [newErr, setNewErr] = useState('')
  const [newOk, setNewOk] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTs, setEditTs] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const toLocalInput = (ts: string) => {
    const d = new Date(ts)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

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

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este registro?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (res.ok) setRecords(prev => prev.filter(r => r.id !== id))
      else { const d = await res.json(); setError(d.error ?? 'Erro ao apagar.') }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setDeleting(null)
    }
  }

  const handleAdd = async () => {
    if (!newEmpId || !newTs) { setNewErr('Preencha todos os campos.'); return }
    setNewSaving(true); setNewErr(''); setNewOk('')
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: newEmpId, type: newType, timestamp: new Date(newTs).toISOString() }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewOk('Registo adicionado!'); setNewTs(''); setNewEmpId(''); setNewType('entrada')
        await load()
      } else { setNewErr(data.error ?? 'Erro ao adicionar.') }
    } catch { setNewErr('Erro de conexão.') }
    finally {
      setNewSaving(false)
      setTimeout(() => setNewOk(''), 2000)
    }
  }

  const handleEdit = async (id: string) => {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: new Date(editTs).toISOString() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRecords(prev => prev.map(r => r.id === id ? { ...r, timestamp: updated.timestamp, date: updated.date } : r))
        setEditingId(null)
      } else {
        const d = await res.json(); setError(d.error ?? 'Erro ao salvar.')
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setEditSaving(false)
    }
  }

  const tagLabel: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Almoço', fim_almoco: 'Ret. Almoço',
    pausa_cafe: 'Café', retorno_cafe: 'Ret. Café',
  }

  return (
    <div className="tab-content space-y-4">
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
                  const isEditing = editingId === r.id
                  return (
                    <div key={r.id}>
                      <div className="record-item">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">{r.employee_name}</div>
                          <div className="text-white/35 text-xs mt-1">
                            {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {' · '}
                            {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={tagClass}>{tagLabel[r.type] ?? r.type}</span>
                          {r.latitude && r.longitude && (
                            <a
                              href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/30 hover:text-blue-400 transition-colors text-xs px-1"
                              title="Ver localização"
                            >📍</a>
                          )}
                          <button
                            onClick={() => { setEditingId(r.id); setEditTs(toLocalInput(r.timestamp)) }}
                            disabled={editSaving}
                            className="text-white/30 hover:text-blue-400 transition-colors text-xs px-1"
                            title="Editar horário"
                          >✏</button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="text-white/30 hover:text-red-400 transition-colors text-xs px-1"
                            title="Apagar registro"
                          >
                            {deleting === r.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-2 py-2 px-1">
                          <input
                            type="datetime-local"
                            value={editTs}
                            onChange={e => setEditTs(e.target.value)}
                            className="glass-input flex-1 text-xs"
                          />
                          <button
                            onClick={() => handleEdit(r.id)}
                            disabled={editSaving}
                            className="btn-glass text-xs px-2 py-1"
                          >{editSaving ? '…' : 'OK'}</button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-white/30 hover:text-white/60 text-xs px-1"
                          >✕</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )
        }
      </div>

      <div className="glass p-5 space-y-3">
        <span className="section-label">Novo registo manual</span>
        <div>
          <label className="input-label">Funcionário</label>
          <select value={newEmpId} onChange={e => setNewEmpId(e.target.value)} className="glass-select">
            <option value="">Selecionar...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Tipo</label>
            <select value={newType} onChange={e => setNewType(e.target.value)} className="glass-select">
              <option value="entrada">Entrada</option>
              <option value="saída">Saída</option>
              <option value="inicio_almoco">Almoço</option>
              <option value="fim_almoco">Ret. Almoço</option>
              <option value="pausa_cafe">Café</option>
              <option value="retorno_cafe">Ret. Café</option>
            </select>
          </div>
          <div>
            <label className="input-label">Data e hora</label>
            <input type="datetime-local" value={newTs} onChange={e => setNewTs(e.target.value)} className="glass-input" />
          </div>
        </div>
        {newErr && <div className="alert-error">{newErr}</div>}
        {newOk  && <div className="alert-success">{newOk}</div>}
        <button onClick={handleAdd} disabled={newSaving} className="btn-glass w-full">
          {newSaving ? 'A adicionar...' : '+ Adicionar registo'}
        </button>
      </div>
    </div>
  )
}

// ─── Funcionários tab ─────────────────────────────────────────────────────────
function EmployeeSettings({ emp, onDone }: { emp: Employee; onDone: () => void }) {
  const [name, setName] = useState(emp.name)
  const [username, setUsername] = useState(emp.username)
  const [email, setEmail] = useState(emp.email ?? '')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>(emp.role as 'employee' | 'manager' | 'admin')
  const [workdayHours, setWorkdayHours] = useState(String(emp.workday_hours))
  const [lunchMin, setLunchMin] = useState(String(emp.lunch_break_minutes))
  const [rate, setRate] = useState(emp.hourly_rate != null ? String(emp.hourly_rate) : '')
  const [geoMode, setGeoMode] = useState<'required' | 'optional' | 'disabled'>(emp.geo_mode ?? 'optional')
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
    if (name !== emp.name) body.name = name
    if (username !== emp.username) body.username = username
    if (email !== (emp.email ?? '')) body.email = email || null
    if (role !== emp.role) body.role = role
    if (geoMode !== (emp.geo_mode ?? 'optional')) body.geo_mode = geoMode
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
        <label className="input-label">Nome completo</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="ex: Maria Silva" className="glass-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Nome de usuário</label>
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="ex: maria.silva" className="glass-input"
          />
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
      <div>
        <label className="input-label">Email (opcional)</label>
        <input
          type="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="maria@empresa.com" className="glass-input"
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
        <label className="input-label">Geolocalização</label>
        <select value={geoMode} onChange={e => setGeoMode(e.target.value as 'required' | 'optional' | 'disabled')} className="glass-select">
          <option value="optional">Opcional (recomendado)</option>
          <option value="required">Obrigatória</option>
          <option value="disabled">Desativada</option>
        </select>
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
  const [email, setEmail] = useState('')
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
        name, username, email: email || null, password, role,
        workday_hours: workdayHours,
        lunch_break_minutes: lunchMin,
        hourly_rate: rate || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(`${name} adicionado!`)
    setName(''); setUsername(''); setEmail(''); setPassword(''); setRole('employee')
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
                    {emp.email && ` · ${emp.email}`}
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
          <div>
            <label className="input-label">Email (opcional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@empresa.com" className="glass-input" />
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

// ─── Helpers for reports ─────────────────────────────────────────────────────
function getWorkingDays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function openPayslip(
  empName: string, period: string, recs: PunchRecord[],
  workdayHours: number, lunchMin: number, hourlyRate: number | null,
) {
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const byDate = new Map<string, PunchRecord[]>()
  recs.forEach(r => {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  })
  let totalMin = 0, totalEarnings = 0
  const rows = Array.from(byDate.keys()).sort().map(date => {
    const day = [...byDate.get(date)!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const explicit = day.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
    const { workedMin, lunchMin: lMin, coffeeMin } = calcTimeBreakdown(day)
    const netMin = explicit ? workedMin : Math.max(0, day.filter(r=>r.type==='entrada').length > 0 ? workedMin - lunchMin : 0)
    const dispLunch = explicit ? lMin : lunchMin
    const dispCoffee = explicit ? coffeeMin : 0
    const [y,m,dNum] = date.split('-').map(Number)
    const dow = DAYS_PT[new Date(y,m-1,dNum).getDay()]
    const dateLabel = `${String(dNum).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} (${dow})`
    const entries = day.filter(r=>r.type==='entrada').map(r=>new Date(r.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))
    const exits = day.filter(r=>r.type==='saída').map(r=>new Date(r.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))
    const earn = hourlyRate && netMin > 0 ? netMin/60*hourlyRate : 0
    totalMin += netMin; totalEarnings += earn
    const rateCell = hourlyRate != null ? `<td>${Number(hourlyRate).toFixed(2).replace('.',',')} €</td>` : ''
    const earnCell = hourlyRate != null ? `<td>${earn.toFixed(2).replace('.',',')} €</td>` : ''
    return `<tr><td>${dateLabel}</td><td>${entries.join(' / ')||'-'}</td><td>${exits.join(' / ')||'-'}</td><td>${dispLunch}</td><td>${dispCoffee}</td><td>${netMin>0?fmtMinutes(netMin):'-'}</td>${rateCell}${earnCell}</tr>`
  }).join('')
  const rateHeader = hourlyRate != null ? '<th>€/hora</th>' : ''
  const earnHeader = hourlyRate != null ? '<th>Ganhos (€)</th>' : ''
  const rateTotal = hourlyRate != null ? '<td></td>' : ''
  const earnTotal = hourlyRate != null ? `<td>${totalEarnings.toFixed(2).replace('.',',')} €</td>` : ''
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Holerite ${empName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#333;padding:24px;max-width:960px;margin:0 auto;font-size:13px}
h1{font-size:20px;margin-bottom:4px}.sub{color:#666;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f0f0f0;border:1px solid #ddd;padding:7px 10px;text-align:left;font-size:12px}
td{border:1px solid #ddd;padding:7px 10px;font-size:12px}.total-row{font-weight:bold;background:#f8f8f8}
.btn{margin-top:20px;padding:10px 24px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px}
@media print{.btn{display:none}}</style></head><body>
<h1>Holerite — ${empName}</h1>
<div class="sub">Período: ${period} · Jornada: ${workdayHours}h · Almoço: ${lunchMin>0?lunchMin+'min':'sem desconto'}${hourlyRate!=null?` · €${Number(hourlyRate).toFixed(2)}/h`:''}</div>
<table><thead><tr><th>Data</th><th>Entrada</th><th>Saída</th><th>Almoço (min)</th><th>Café (min)</th><th>Total Horas</th>${rateHeader}${earnHeader}</tr></thead>
<tbody>${rows}<tr class="total-row"><td colspan="5">TOTAL</td><td>${fmtMinutes(totalMin)}</td>${rateTotal}${earnTotal}</tr></tbody></table>
<button class="btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Relatórios tab ───────────────────────────────────────────────────────────
function RelatoriosTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [filterEmpId, setFilterEmpId] = useState('all')
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
      const params = new URLSearchParams({ from, to })
      if (filterEmpId !== 'all') params.set('employeeId', filterEmpId)
      const res = await fetch(`/api/reports?${params}`)
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

        <div>
          <label className="input-label">Funcionário</label>
          <select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} className="glass-select">
            <option value="all">Todos</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
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

                {Object.entries(byEmp).map(([empId, { name, records: recs }]) => {
                  const emp = employees.find(e => e.id === empId)
                  const overtime = calcOvertimePeriod(recs)
                  return (
                    <div key={empId} className="record-item">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{name}</div>
                        <div className="text-white/35 text-xs mt-0.5">{recs.length} registros</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <div className="font-bold text-white text-sm">{calcHours(recs)}</div>
                          {overtime !== null && (
                            <span className={overtime >= 0 ? 'overtime-pos' : 'overtime-neg'}>
                              {overtime >= 0 ? '+' : '-'}{fmtMinutes(overtime)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => openPayslip(name, `${from} a ${to}`, recs, emp?.workday_hours ?? 8, emp?.lunch_break_minutes ?? 60, emp?.hourly_rate ?? null)}
                          className="text-white/30 hover:text-purple-400 transition-colors px-1 text-base"
                          title="Gerar holerite PDF"
                        >📄</button>
                      </div>
                    </div>
                  )
                })}

                {/* Daily hours bar chart */}
                {(() => {
                  const workingDays = getWorkingDays(from, to)
                  if (workingDays.length < 2) return null
                  const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
                  records.forEach(r => {
                    if (!byDateEmp.has(r.date)) byDateEmp.set(r.date, new Map())
                    const em = byDateEmp.get(r.date)!
                    if (!em.has(r.employee_id)) em.set(r.employee_id, [])
                    em.get(r.employee_id)!.push(r)
                  })
                  const chartData = workingDays.map(date => {
                    const empMap = byDateEmp.get(date)
                    if (!empMap) return { date, min: 0 }
                    let totalMin = 0
                    empMap.forEach((dayRecs, eId) => {
                      const e = employees.find(emp => emp.id === eId)
                      const lMin = e?.lunch_break_minutes ?? 60
                      const hasBreaks = dayRecs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
                      totalMin += hasBreaks ? calcTimeBreakdown(dayRecs).workedMin : Math.max(0, calcNetMinutes(dayRecs, lMin))
                    })
                    return { date, min: totalMin }
                  })
                  const maxMin = Math.max(...chartData.map(d => d.min), 1)
                  return (
                    <div className="mt-5">
                      <span className="section-label">Horas por dia</span>
                      <div className="flex items-end gap-px mt-3" style={{ height: '64px' }}>
                        {chartData.map(({ date, min }) => {
                          const pct = Math.min(100, (min / maxMin) * 100)
                          const d = new Date(date + 'T12:00:00')
                          const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
                          return (
                            <div key={date} className="flex-1 h-full flex flex-col justify-end" title={label}>
                              <div
                                className={`w-full rounded-t transition-colors ${min === 0 ? 'bg-white/10' : 'bg-indigo-400/50 hover:bg-indigo-400/70'}`}
                                style={{ height: pct > 0 ? `${pct}%` : '3px' }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Absence report */}
                {(() => {
                  const workingDays = getWorkingDays(from, to)
                  if (workingDays.length === 0) return null
                  const targetEmps = filterEmpId === 'all'
                    ? employees
                    : employees.filter(e => e.id === filterEmpId)
                  const presentDates = new Map<string, Set<string>>()
                  records.forEach(r => {
                    if (!presentDates.has(r.employee_id)) presentDates.set(r.employee_id, new Set())
                    presentDates.get(r.employee_id)!.add(r.date)
                  })
                  const absences = targetEmps
                    .map(emp => ({ empName: emp.name, dates: workingDays.filter(d => !presentDates.get(emp.id)?.has(d)) }))
                    .filter(a => a.dates.length > 0)
                  return (
                    <div className="mt-5">
                      <span className="section-label">Faltas / Ausências</span>
                      {absences.length === 0
                        ? <div className="alert-info mt-2 text-xs">✅ Sem ausências no período.</div>
                        : absences.map(({ empName, dates }) => (
                          <div key={empName} className="mt-2 py-2 border-b border-white/5 last:border-0">
                            <div className="text-sm text-white/70 mb-1">
                              {empName} <span className="text-red-400/80">({dates.length} falta{dates.length > 1 ? 's' : ''})</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {dates.map(d => {
                                const dt = new Date(d + 'T12:00:00')
                                return (
                                  <span key={d} className="text-xs bg-red-400/10 text-red-300/80 px-2 py-0.5 rounded-full border border-red-400/20">
                                    {String(dt.getDate()).padStart(2,'0')}/{String(dt.getMonth()+1).padStart(2,'0')}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )
                })()}

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

// ─── Dashboard tab ────────────────────────────────────────────────────────────
function DashboardTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]

  const [monthRecs, setMonthRecs] = useState<PunchRecord[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [bankBalances, setBankBalances] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, tRes] = await Promise.all([
        fetch(`/api/reports?from=${firstOfMonth}&to=${todayStr}`),
        fetch('/api/records?today=true'),
      ])
      if (mRes.ok) setMonthRecs(await mRes.json())
      if (tRes.ok) setTodayRecs(await tRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [firstOfMonth, todayStr])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (employees.length === 0) return
    const fetchAll = async () => {
      const map = new Map<string, number>()
      await Promise.all(employees.map(async emp => {
        try {
          const res = await fetch(`/api/hour-bank?employeeId=${emp.id}`)
          if (res.ok) { const d = await res.json(); map.set(emp.id, d.balanceMin) }
        } catch { /* silent */ }
      }))
      setBankBalances(new Map(map))
    }
    fetchAll()
  }, [employees])

  const todayByEmp = new Map<string, PunchRecord[]>()
  todayRecs.forEach(r => {
    if (!todayByEmp.has(r.employee_id)) todayByEmp.set(r.employee_id, [])
    todayByEmp.get(r.employee_id)!.push(r)
  })

  const onlineNow = employees.filter(emp => {
    const recs = [...(todayByEmp.get(emp.id) ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const last = recs.at(-1)
    return last && WORKING_TYPES.includes(last.type)
  }).length

  const workingDays = getWorkingDays(firstOfMonth, todayStr)
  const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
  monthRecs.forEach(r => {
    if (!byDateEmp.has(r.date)) byDateEmp.set(r.date, new Map())
    const em = byDateEmp.get(r.date)!
    if (!em.has(r.employee_id)) em.set(r.employee_id, [])
    em.get(r.employee_id)!.push(r)
  })

  const chartData = workingDays.map(date => {
    const empMap = byDateEmp.get(date)
    if (!empMap) return { date, min: 0 }
    let totalMin = 0
    empMap.forEach((dayRecs, eId) => {
      const e = employees.find(emp => emp.id === eId)
      const lMin = e?.lunch_break_minutes ?? 60
      const hasBreaks = dayRecs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
      totalMin += hasBreaks ? calcTimeBreakdown(dayRecs).workedMin : Math.max(0, calcNetMinutes(dayRecs, lMin))
    })
    return { date, min: totalMin }
  })
  const maxChartMin = Math.max(...chartData.map(d => d.min), 1)

  const byEmpMonth: Record<string, PunchRecord[]> = {}
  monthRecs.forEach(r => {
    if (!byEmpMonth[r.employee_id]) byEmpMonth[r.employee_id] = []
    byEmpMonth[r.employee_id].push(r)
  })
  const totalMonthMin = Object.values(byEmpMonth).reduce((sum, recs) => {
    return sum + Math.max(0, calcOvertimePeriod(recs, 0, 60) ?? 0)
  }, 0)

  if (loading) return (
    <div className="tab-content">
      <div className="glass p-5"><div className="alert-info">Carregando dashboard...</div></div>
    </div>
  )

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-box">
            <div className="metric-val text-green-300">{onlineNow}</div>
            <div className="metric-lbl">Online agora</div>
          </div>
          <div className="metric-box">
            <div className="metric-val">{totalMonthMin > 0 ? fmtMinutes(Math.round(totalMonthMin)) : '—'}</div>
            <div className="metric-lbl">Horas este mês</div>
          </div>
        </div>
      </div>

      {workingDays.length >= 2 && (
        <div className="glass p-5">
          <span className="section-label">
            Horas por dia — {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-end gap-px mt-4" style={{ height: '80px' }}>
            {chartData.map(({ date, min }) => {
              const pct = Math.min(100, (min / maxChartMin) * 100)
              const d = new Date(date + 'T12:00:00')
              const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
              const isToday = date === todayStr
              return (
                <div key={date} className="flex-1 h-full flex flex-col justify-end" title={label}>
                  <div
                    className={`w-full rounded-t transition-colors ${min === 0 ? 'bg-white/10' : isToday ? 'bg-green-400/50 hover:bg-green-400/70' : 'bg-indigo-400/50 hover:bg-indigo-400/70'}`}
                    style={{ height: pct > 0 ? `${pct}%` : '3px' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="glass p-5">
        <span className="section-label">Funcionários — este mês</span>
        {employees.map(emp => {
          const empRecs = byEmpMonth[emp.id] ?? []
          const monthMin = empRecs.length > 0 ? Math.max(0, calcOvertimePeriod(empRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
          const targetMin = emp.workday_hours * 60 * workingDays.length
          const pct = targetMin > 0 ? Math.min(100, (monthMin / targetMin) * 100) : 0
          const bank = bankBalances.get(emp.id)
          return (
            <div key={emp.id} className="py-3 border-b border-white/5 last:border-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-white text-sm font-medium">{emp.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs">{monthMin > 0 ? fmtMinutes(Math.round(monthMin)) : '—'}</span>
                  {bank !== undefined && (
                    <span className={`text-xs font-medium ${bank >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                      banco: {bank >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bank))}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-400' : pct >= 75 ? 'bg-indigo-400' : 'bg-white/40'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Banco de horas tab ───────────────────────────────────────────────────────
function BancoHorasTab({ employees }: { employees: Employee[] }) {
  const [balances, setBalances] = useState<Map<string, { balanceMin: number; adjustments: HourBankAdjustment[] }>>(new Map())
  const [selectedEmp, setSelectedEmp] = useState('')
  const [minutes, setMinutes] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const map = new Map<string, { balanceMin: number; adjustments: HourBankAdjustment[] }>()
    await Promise.all(employees.map(async emp => {
      try {
        const res = await fetch(`/api/hour-bank?employeeId=${emp.id}`)
        if (res.ok) { const d = await res.json(); map.set(emp.id, d) }
      } catch { /* silent */ }
    }))
    setBalances(new Map(map))
  }, [employees])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setOk(''); setSaving(true)
    const mins = Number(minutes)
    if (!selectedEmp) { setErr('Selecione um funcionário.'); setSaving(false); return }
    if (isNaN(mins) || mins === 0) { setErr('Minutos inválidos.'); setSaving(false); return }
    if (!reason.trim()) { setErr('Motivo obrigatório.'); setSaving(false); return }
    const res = await fetch('/api/hour-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmp, minutes: mins, reason: reason.trim(), date }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao salvar.'); setSaving(false); return }
    setOk('Ajuste registado!')
    setMinutes(''); setReason('')
    setSaving(false)
    await loadAll()
    setTimeout(() => setOk(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este ajuste?')) return
    const res = await fetch(`/api/hour-bank/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Erro ao remover.'); return }
    await loadAll()
  }

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5">
        <span className="section-label">Saldos actuais</span>
        {employees.length === 0 && <div className="alert-info mt-2">Nenhum funcionário.</div>}
        {employees.map(emp => {
          const info = balances.get(emp.id)
          const bal = info?.balanceMin
          return (
            <div key={emp.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-white text-sm">{emp.name}</span>
              {bal !== undefined
                ? <span className={`text-sm font-semibold ${bal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bal >= 0 ? '+' : '-'}{Math.floor(Math.abs(bal) / 60)}h{String(Math.abs(bal) % 60).padStart(2, '0')}m
                  </span>
                : <span className="text-white/30 text-xs">—</span>
              }
            </div>
          )
        })}
      </div>

      <div className="glass p-5">
        <span className="section-label">Novo ajuste manual</span>
        <form onSubmit={handleAdd} className="space-y-3 mt-3">
          <div>
            <label className="input-label">Funcionário</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="glass-select">
              <option value="">Selecionar...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Minutos (positivo = crédito)</label>
              <input
                type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                placeholder="ex: 60 ou -30" className="glass-input"
              />
            </div>
            <div>
              <label className="input-label">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="glass-input" />
            </div>
          </div>
          <div>
            <label className="input-label">Motivo</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ex: Banco de horas acordado" className="glass-input" />
          </div>
          {err && <div className="alert-error">{err}</div>}
          {ok  && <div className="alert-success">{ok}</div>}
          <button type="submit" disabled={saving} className="btn-glass w-full">
            {saving ? 'Salvando...' : '+ Registar ajuste'}
          </button>
        </form>
      </div>

      {selectedEmp && (() => {
        const adjs = balances.get(selectedEmp)?.adjustments ?? []
        if (adjs.length === 0) return null
        const empName = employees.find(e => e.id === selectedEmp)?.name ?? ''
        return (
          <div className="glass p-5">
            <span className="section-label">Ajustes de {empName}</span>
            {adjs.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">{a.reason}</div>
                  <div className="text-white/35 text-xs">{a.date}</div>
                </div>
                <span className={`text-sm font-semibold ${a.minutes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.minutes >= 0 ? '+' : ''}{a.minutes}min
                </span>
                <button onClick={() => handleDelete(a.id)} className="btn-danger text-xs px-2">✕</button>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Feriados / Folgas tab ────────────────────────────────────────────────────
function FeriadosTab() {
  const [exceptions, setExceptions] = useState<DayException[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [type, setType] = useState<'holiday' | 'day_off'>('holiday')
  const [description, setDescription] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/day-exceptions')
      if (res.ok) setExceptions(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setOk(''); setSaving(true)
    const res = await fetch('/api/day-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, type, description: description.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao salvar.'); setSaving(false); return }
    setOk('Registado!')
    setDescription('')
    setSaving(false)
    await load()
    setTimeout(() => setOk(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este feriado/folga?')) return
    const res = await fetch(`/api/day-exceptions/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Erro ao remover.'); return }
    await load()
  }

  const TYPE_LABEL: Record<string, string> = { holiday: 'Feriado', day_off: 'Folga' }

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5">
        <span className="section-label">Adicionar feriado / folga</span>
        <form onSubmit={handleAdd} className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="glass-input" required />
            </div>
            <div>
              <label className="input-label">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as 'holiday' | 'day_off')} className="glass-select">
                <option value="holiday">Feriado</option>
                <option value="day_off">Folga</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Descrição</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Natal" className="glass-input" required />
          </div>
          {err && <div className="alert-error">{err}</div>}
          {ok  && <div className="alert-success">{ok}</div>}
          <button type="submit" disabled={saving} className="btn-glass w-full">
            {saving ? 'Salvando...' : '+ Adicionar'}
          </button>
        </form>
      </div>

      <div className="glass p-5">
        {loading
          ? <div className="alert-info">Carregando...</div>
          : exceptions.length === 0
          ? <div className="alert-info">Nenhum feriado ou folga registada.</div>
          : (
            <>
              <span className="section-label">{exceptions.length} registo(s)</span>
              {exceptions.map(exc => (
                <div key={exc.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{exc.description}</div>
                    <div className="text-white/35 text-xs">{new Date(exc.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${exc.type === 'holiday' ? 'bg-indigo-400/20 text-indigo-300' : 'bg-emerald-400/20 text-emerald-300'}`}>
                    {TYPE_LABEL[exc.type]}
                  </span>
                  <button onClick={() => handleDelete(exc.id)} className="btn-danger text-xs px-2">✕</button>
                </div>
              ))}
            </>
          )
        }
      </div>
    </div>
  )
}

// ─── Auditoria tab ────────────────────────────────────────────────────────────
const AUDIT_LABELS: Record<string, string> = {
  employee_create:           '👤 Funcionário criado',
  employee_update:           '✏ Funcionário atualizado',
  employee_delete:           '🗑 Funcionário desativado',
  record_create:             '➕ Registo criado',
  record_update:             '✏ Registo editado',
  record_delete:             '🗑 Registo apagado',
  punch_on_behalf:           '▶ Ponto registado por admin',
  hour_bank_adjustment:      '⚖ Ajuste banco de horas',
  hour_bank_adjustment_delete: '🗑 Ajuste banco removido',
  day_exception_create:      '📅 Feriado/folga criado',
  day_exception_delete:      '🗑 Feriado/folga removido',
}

function AuditoriaTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (actionFilter !== 'all') params.set('action', actionFilter)
      const res = await fetch(`/api/audit?${params}`)
      if (res.ok) setLogs(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [actionFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="tab-content space-y-4">
      <div className="glass p-5">
        <span className="section-label">Filtro</span>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="glass-select mt-3">
          <option value="all">Todas as ações</option>
          {Object.entries(AUDIT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="glass p-5">
        {loading
          ? <div className="alert-info">Carregando...</div>
          : logs.length === 0
          ? <div className="alert-info">Nenhum registo de auditoria.</div>
          : (
            <>
              <span className="section-label">{logs.length} evento(s)</span>
              {logs.map(log => (
                <div key={log.id} className="record-item">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {AUDIT_LABELS[log.action] ?? log.action}
                      {log.target_name && <span className="text-white/50 font-normal"> — {log.target_name}</span>}
                    </div>
                    <div className="text-white/35 text-xs mt-0.5">
                      por {log.actor_name} · {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )
        }
      </div>
    </div>
  )
}

// ─── Missing-exit alert banner ────────────────────────────────────────────────
function MissingExitBanner() {
  const [alerts, setAlerts] = useState<{ name: string; date: string }[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      const weekAgo   = new Date(now); weekAgo.setDate(now.getDate() - 7)
      try {
        const res = await fetch(`/api/reports?from=${fmt(weekAgo)}&to=${fmt(yesterday)}`)
        if (!res.ok) return
        const records: PunchRecord[] = await res.json()
        const byEmpDate = new Map<string, Map<string, PunchRecord[]>>()
        records.forEach(r => {
          if (!byEmpDate.has(r.employee_id)) byEmpDate.set(r.employee_id, new Map())
          const dm = byEmpDate.get(r.employee_id)!
          if (!dm.has(r.date)) dm.set(r.date, [])
          dm.get(r.date)!.push(r)
        })
        const missing: { name: string; date: string }[] = []
        byEmpDate.forEach((dm, empId) => {
          const empName = records.find(r => r.employee_id === empId)?.employee_name ?? empId
          dm.forEach((dayRecs, date) => {
            const last = [...dayRecs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1)
            if (last && WORKING_TYPES.includes(last.type)) missing.push({ name: empName, date })
          })
        })
        setAlerts(missing)
      } catch { /* silent */ }
    }
    check()
  }, [])

  if (dismissed || alerts.length === 0) return null

  return (
    <div className="glass p-4 mb-4 border border-amber-400/30 bg-amber-400/5 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-amber-300 font-semibold text-sm mb-2">
            ⚠ {alerts.length} dia(s) sem saída registrada
          </div>
          <div className="space-y-0.5">
            {alerts.map((a, i) => (
              <div key={i} className="text-white/55 text-xs">
                {a.name} — {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/30 hover:text-white/60 transition-colors text-sm leading-none"
          title="Fechar"
        >✕</button>
      </div>
    </div>
  )
}

// ─── Admin page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? MANAGER_TABS : ALL_TABS
  const [showPwd, setShowPwd] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const router = useRouter()

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      if (data.role === 'manager') setTab('meu_ponto')
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

        {/* Missing-exit alerts */}
        <MissingExitBanner />

        {/* Tab content */}
        <div key={tab}>
          {tab === 'meu_ponto'    && (
            <div className="tab-content max-w-md mx-auto">
              <PunchCard
                workdayMinutes={Math.round(user.workday_hours * 60)}
                lunchBreakMinutes={user.lunch_break_minutes}
                hourlyRate={user.hourly_rate}
                userId={user.id}
                geoMode={user.geo_mode}
              />
            </div>
          )}
          {tab === 'dashboard'    && <DashboardTab employees={employees} />}
          {tab === 'status'       && <StatusTab employees={employees} currentUserId={user.id} />}
          {tab === 'registros'    && <RegistrosTab employees={employees} />}
          {tab === 'funcionarios' && <FuncionariosTab employees={employees} onRefresh={loadEmployees} />}
          {tab === 'banco'        && <BancoHorasTab employees={employees} />}
          {tab === 'feriados'     && <FeriadosTab />}
          {tab === 'relatorios'   && <RelatoriosTab employees={employees} />}
          {tab === 'auditoria'    && user.role === 'admin' && <AuditoriaTab />}
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
