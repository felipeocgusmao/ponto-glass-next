'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { avatarInitials, exportCSV, calcOvertimePeriod, calcHours, fmtMinutes, calcNetMinutes, calcTimeBreakdown, WORKING_TYPES } from '@/lib/utils'
import type { Employee, EmployeeProfile, PunchRecord, AuditLog, HourBankAdjustment, DayException } from '@/lib/types'

type Tab = 'meu_ponto' | 'status' | 'registros' | 'funcionarios' | 'relatorios' | 'dashboard' | 'auditoria' | 'banco' | 'feriados'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard',    label: 'Dashboard'  },
  { id: 'status',       label: 'Status'     },
  { id: 'registros',    label: 'Registros'  },
  { id: 'funcionarios', label: 'Equipe'     },
  { id: 'banco',        label: 'Banco'      },
  { id: 'feriados',     label: 'Feriados'   },
  { id: 'relatorios',   label: 'Relatório'  },
  { id: 'auditoria',    label: 'Auditoria'  },
]

const MANAGER_TABS: { id: Tab; label: string }[] = [
  { id: 'meu_ponto',    label: 'Meu Ponto'  },
  { id: 'dashboard',    label: 'Dashboard'  },
  { id: 'status',       label: 'Status'     },
  { id: 'registros',    label: 'Registros'  },
  { id: 'banco',        label: 'Banco'      },
  { id: 'feriados',     label: 'Feriados'   },
  { id: 'relatorios',   label: 'Relatório'  },
]

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconList({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="0.8" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="0.8" fill="currentColor" stroke="none"/></svg>
}
function IconUsers({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconBar({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function IconStatus({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function IconClock({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
}
function IconDashboard({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v9H3z"/><path d="M14 3h7v5h-7z"/><path d="M14 12h7v9h-7z"/><path d="M3 16h7v5H3z"/></svg>
}
function IconAudit({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function IconBank({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
}
function IconCalendar({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconHamburger() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}
function LockSmIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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

// ─── Shared helpers ───────────────────────────────────────────────────────────
const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

function empColor(id: string): number { return (id.charCodeAt(0) % 8) + 1 }

function SL({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

type WorkState = 'working' | 'lunch' | 'coffee' | 'off'

function getWorkState(recs: PunchRecord[]): { state: WorkState; since: string | null } {
  if (recs.length === 0) return { state: 'off', since: null }
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted.at(-1)!
  const since = new Date(last.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (last.type === 'inicio_almoco') return { state: 'lunch', since }
  if (last.type === 'pausa_cafe') return { state: 'coffee', since }
  if (last.type === 'saída') return { state: 'off', since }
  if (WORKING_TYPES.includes(last.type)) return { state: 'working', since }
  return { state: 'off', since }
}

function calcLiveMin(recs: PunchRecord[], lunchAuto: number): number {
  const hasBreaks = recs.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
  const { state } = getWorkState(recs)
  if (hasBreaks) {
    const bd = calcTimeBreakdown(recs)
    if (state !== 'working') return bd.workedMin
    const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastWork = sorted.slice().reverse().find(r => WORKING_TYPES.includes(r.type))
    const ongoing = lastWork ? (Date.now() - new Date(lastWork.timestamp).getTime()) / 60000 : 0
    return Math.max(0, bd.workedMin + ongoing)
  }
  const totalWorked = calcNetMinutes(recs, 0)
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const lastEntry = state === 'working' ? sorted.slice().reverse().find(r => r.type === 'entrada') : undefined
  const ongoing = lastEntry ? (Date.now() - new Date(lastEntry.timestamp).getTime()) / 60000 : 0
  return Math.max(0, totalWorked + ongoing - lunchAuto)
}

function fmtMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function ProgressRing({ pct, overtime }: { pct: number; overtime: boolean }) {
  const r = 42, c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, pct / 100))
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="6"/>
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={overtime ? 'var(--warning-fg)' : pct >= 100 ? 'var(--success-fg)' : 'var(--accent)'}
        strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(res => {
    if (!navigator.geolocation) { res(null); return }
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 8000 }
    )
  })
}

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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, tabs, user, onLogout, onChangePwd, theme, toggleTheme, mobileOpen, onMobileClose }: {
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
        <div className="sb-logo">P</div>
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

// ─── Meu Ponto tab ────────────────────────────────────────────────────────────
function MeuPontoTab({ user }: { user: EmployeeProfile }) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [now, setNow] = useState(new Date())
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadRecords = useCallback(async () => {
    const res = await fetch('/api/records?today=true')
    if (res.ok) {
      const all: PunchRecord[] = await res.json()
      setRecords(all.filter(r => r.employee_id === user.id))
    }
  }, [user.id])

  useEffect(() => { loadRecords() }, [loadRecords])
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  const { state } = getWorkState(records)
  const liveMin = calcLiveMin(records, user.lunch_break_minutes)
  const workdayMin = user.workday_hours * 60
  const pct = workdayMin > 0 ? (liveMin / workdayMin) * 100 : 0
  const isOvertime = liveMin > workdayMin

  const punch = async (type: string) => {
    setPunching(true)
    let lat: number | undefined, lng: number | undefined
    if (user.geo_mode !== 'disabled') {
      const geo = await getGeo()
      if (geo) { lat = geo.lat; lng = geo.lng }
      else if (user.geo_mode === 'required') {
        setToast({ kind: 'err', text: 'Localização obrigatória. Ative o GPS.' })
        setPunching(false); return
      }
    }
    const res = await fetch('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, latitude: lat, longitude: lng }),
    })
    const data = await res.json()
    if (!res.ok) {
      setToast({ kind: 'err', text: data.error ?? 'Erro ao registrar.' })
      setPunching(false); return
    }
    setToast({ kind: 'ok', text: 'Registrado!' })
    setPunching(false)
    loadRecords()
    setTimeout(() => setToast(null), 2500)
  }

  const tagLabel: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Almoço', fim_almoco: 'Ret. Almoço',
    pausa_cafe: 'Café', retorno_cafe: 'Ret. Café',
  }

  const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {toast && <div className={`alert-inline ${toast.kind}`}>{toast.text}</div>}

        <div style={{ textAlign: 'center' }}>
          <div className="tnum mono" style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {hh}:{mm}<span style={{ fontSize: 24, color: 'var(--fg-muted)' }}>:{ss}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`chip ${state === 'working' ? 'success' : state === 'lunch' || state === 'coffee' ? 'warn' : 'outline'}`}>
              {state === 'working' ? '● Em serviço' : state === 'lunch' ? '🍽 No almoço' : state === 'coffee' ? '☕ Pausa café' : '○ Fora do expediente'}
            </span>
          </div>
        </div>

        <div className="emp-progress">
          <ProgressRing pct={pct} overtime={isOvertime} />
          <div className="emp-stats">
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trabalhado</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>{liveMin > 0 ? fmtMin(Math.round(liveMin)) : '0m'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Meta</div>
              <div className="tnum" style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-muted)', marginTop: 2 }}>{fmtMin(workdayMin)}</div>
            </div>
          </div>
        </div>

        <div className="emp-actions">
          {state === 'off' && (
            <button onClick={() => punch('entrada')} disabled={punching} className="btn-emp primary-big">
              {punching ? '…' : '▶ Registrar Entrada'}
            </button>
          )}
          {state === 'working' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => punch('inicio_almoco')} disabled={punching} className="btn-emp warn">🍽 Almoço</button>
              <button onClick={() => punch('pausa_cafe')} disabled={punching} className="btn-emp warn">☕ Café</button>
              <button onClick={() => punch('saída')} disabled={punching} className="btn-emp danger-big" style={{ flex: 2 }}>⏹ Saída</button>
            </div>
          )}
          {state === 'lunch' && (
            <button onClick={() => punch('fim_almoco')} disabled={punching} className="btn-emp warn">🍽 Retornar do Almoço</button>
          )}
          {state === 'coffee' && (
            <button onClick={() => punch('retorno_cafe')} disabled={punching} className="btn-emp warn">☕ Retornar do Café</button>
          )}
        </div>

        <div className="emp-history">
          <div className="emp-history-head"><span>Hoje</span></div>
          {sorted.length === 0
            ? <div className="emp-history-empty">Nenhum registro hoje</div>
            : (
              <div className="emp-history-list">
                {sorted.map(r => (
                  <div key={r.id} className="emp-history-item">
                    <span className={`chip ${r.type === 'entrada' ? 'success' : r.type === 'saída' ? 'danger' : 'warn'}`} style={{ fontSize: 11 }}>
                      {tagLabel[r.type] ?? r.type}
                    </span>
                    <span className="tnum" style={{ fontSize: 13, color: 'var(--fg-muted)', marginLeft: 'auto' }}>
                      {new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

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
  useEffect(() => { const iv = setInterval(() => setLiveMs(Date.now()), 30_000); return () => clearInterval(iv) }, [])
  useEffect(() => { const iv = setInterval(load, 60_000); return () => clearInterval(iv) }, [load])

  const handlePunch = async (emp: Employee, type: 'entrada' | 'saída') => {
    setPunching(emp.id); setMsg(null)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, employeeId: emp.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ id: emp.id, kind: 'success', text: type === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!' })
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
    const isWorking = lastType != null && WORKING_TYPES.includes(lastType)
    const isOnLunch = lastType === 'inicio_almoco'
    const isOnCafe  = lastType === 'pausa_cafe'
    const isIn = isWorking || isOnLunch || isOnCafe
    const hasBreaks = empRecords.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
    let liveNetMin = 0
    if (hasBreaks) {
      const bd = calcTimeBreakdown(empRecords)
      const lastWorkStart = isWorking ? sortedAsc.slice().reverse().find(r => WORKING_TYPES.includes(r.type)) : undefined
      const ongoingMin = lastWorkStart ? (liveMs - new Date(lastWorkStart.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, bd.workedMin + ongoingMin)
    } else {
      const lastEntry = isWorking ? sortedAsc.slice().reverse().find(r => r.type === 'entrada') : undefined
      const currentSessionMin = lastEntry ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000 : 0
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
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="kpi">
            <div className="kpi-label">Em serviço agora</div>
            <div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{onlineCount}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Horas hoje (total)</div>
            <div className="kpi-value">{totalMinToday > 0 ? fmtMinutes(Math.round(totalMinToday)) : '—'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px 8px' }}>
          <SL>{workers.length} funcionário(s)</SL>
        </div>
        {workers.length === 0 && (
          <div style={{ padding: '0 20px 16px' }}><div className="alert-inline info">Nenhum funcionário cadastrado.</div></div>
        )}
        {statuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal }) => (
          <div key={emp.id} className="status-row">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className={`avatar size-28 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 8, height: 8, borderRadius: '50%',
                background: isWorking ? 'var(--success-fg)' : (isOnLunch || isOnCafe) ? 'var(--warning-fg)' : 'var(--fg-dim)',
                border: '2px solid var(--bg)',
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{emp.name}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: 'var(--fg-muted)' }}>
                {isWorking
                  ? <span style={{ color: 'var(--success-fg)' }}>● Em serviço · {liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '< 1min'}</span>
                  : isOnLunch
                  ? <span style={{ color: 'var(--warning-fg)' }}>🍽 No almoço</span>
                  : isOnCafe
                  ? <span style={{ color: 'var(--warning-fg)' }}>☕ Pausa café</span>
                  : <span>{liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) + ' hoje' : 'Sem registro hoje'}</span>
                }
              </div>
              {liveEarnings && <div style={{ fontSize: 11, color: 'var(--success-fg)', marginTop: 2, opacity: 0.75 }}>{liveEarnings} hoje</div>}
              {weekTotal > 0 && <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>{fmtMinutes(weekTotal)} esta semana</div>}
              {msg?.id === emp.id && (
                <div style={{ fontSize: 12, marginTop: 4, color: msg.kind === 'success' ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{msg.text}</div>
              )}
            </div>
            <button
              onClick={() => handlePunch(emp, isIn ? 'saída' : 'entrada')}
              disabled={punching === emp.id}
              className={isIn ? 'btn danger sm' : 'btn primary sm'}
            >
              {punching === emp.id ? '…' : isIn ? '⏹ Saída' : '▶ Entrada'}
            </button>
          </div>
        ))}
      </div>
    </>
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
    } catch { setError('Erro ao conectar.') }
    finally { setLoading(false) }
  }, [from, to, empId])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este registro?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (res.ok) setRecords(prev => prev.filter(r => r.id !== id))
      else { const d = await res.json(); setError(d.error ?? 'Erro ao apagar.') }
    } catch { setError('Erro de conexão.') }
    finally { setDeleting(null) }
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
    finally { setNewSaving(false); setTimeout(() => setNewOk(''), 2000) }
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
      } else { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.') }
    } catch { setError('Erro de conexão.') }
    finally { setEditSaving(false) }
  }

  const tagLabel: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Almoço', fim_almoco: 'Ret. Almoço',
    pausa_cafe: 'Café', retorno_cafe: 'Ret. Café',
  }

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Filtros</SL>
          <div className="form-grid-2">
            <div className="field">
              <label>De</label>
              <input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" />
            </div>
            <div className="field">
              <label>Até</label>
              <input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" />
            </div>
          </div>
          <div className="field">
            <label>Funcionário</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input">
              <option value="all">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert-inline err" style={{ marginBottom: 12 }}>{error}</div>}
          {loading
            ? <div className="alert-inline info">Carregando...</div>
            : records.length === 0
              ? <div className="alert-inline info">Nenhum registro para este filtro.</div>
              : (
                <>
                  <SL>{records.length} registro(s)</SL>
                  {records.map(r => {
                    const isEditing = editingId === r.id
                    return (
                      <div key={r.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{r.employee_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                              {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                              {' · '}
                              {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span className={`chip ${r.type === 'entrada' ? 'success' : r.type === 'saída' ? 'danger' : 'warn'}`} style={{ fontSize: 11 }}>
                              {tagLabel[r.type] ?? r.type}
                            </span>
                            {r.latitude && r.longitude && (
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: 'var(--fg-muted)', textDecoration: 'none' }} title="Ver localização">📍</a>
                            )}
                            <button onClick={() => { setEditingId(r.id); setEditTs(toLocalInput(r.timestamp)) }}
                              disabled={editSaving} className="btn ghost sm icon" title="Editar horário">✏</button>
                            <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                              className="btn ghost sm icon" title="Apagar">{deleting === r.id ? '…' : '✕'}</button>
                          </div>
                        </div>
                        {isEditing && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                            <input type="datetime-local" value={editTs} onChange={e => setEditTs(e.target.value)} className="input" style={{ flex: 1, fontSize: 13 }} />
                            <button onClick={() => handleEdit(r.id)} disabled={editSaving} className="btn primary sm">
                              {editSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="btn ghost sm">✕</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
          }
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Novo registo manual</SL>
          <div className="field">
            <label>Funcionário</label>
            <select value={newEmpId} onChange={e => setNewEmpId(e.target.value)} className="input">
              <option value="">Selecionar...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="field">
              <label>Tipo</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="input">
                <option value="entrada">Entrada</option>
                <option value="saída">Saída</option>
                <option value="inicio_almoco">Almoço</option>
                <option value="fim_almoco">Ret. Almoço</option>
                <option value="pausa_cafe">Café</option>
                <option value="retorno_cafe">Ret. Café</option>
              </select>
            </div>
            <div className="field">
              <label>Data e hora</label>
              <input type="datetime-local" value={newTs} onChange={e => setNewTs(e.target.value)} className="input" />
            </div>
          </div>
          {newErr && <div className="alert-inline err">{newErr}</div>}
          {newOk  && <div className="alert-inline ok">{newOk}</div>}
          <button onClick={handleAdd} disabled={newSaving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            {newSaving ? 'A adicionar...' : '+ Adicionar registo'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Employee settings ────────────────────────────────────────────────────────
function EmployeeSettings({ emp, onDone }: { emp: Employee; onDone: () => void }) {
  const [name, setName] = useState(emp.name)
  const [username, setUsername] = useState(emp.username)
  const [email, setEmail] = useState(emp.email ?? '')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>(emp.role)
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
    const body: Record<string, unknown> = { workday_hours: workdayHours, lunch_break_minutes: lunchMin, hourly_rate: rate }
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
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="field">
        <label>Nome completo</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Maria Silva" className="input" />
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label>Nome de usuário</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ex: maria.silva" className="input" />
        </div>
        <div className="field">
          <label>Perfil</label>
          <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
            <option value="employee">Funcionário</option>
            <option value="manager">Gerente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Email (opcional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
      </div>
      <div className="form-grid-3">
        <div className="field">
          <label>Jornada</label>
          <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
            {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <div className="field">
          <label>Almoço</label>
          <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
            <option value="0">Sem desconto</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        <div className="field">
          <label>€/hora</label>
          <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="0,00" className="input" />
        </div>
      </div>
      <div className="field">
        <label>Geolocalização</label>
        <select value={geoMode} onChange={e => setGeoMode(e.target.value as 'required' | 'optional' | 'disabled')} className="input">
          <option value="optional">Opcional (recomendado)</option>
          <option value="required">Obrigatória</option>
          <option value="disabled">Desativada</option>
        </select>
      </div>
      <div className="field">
        <label>Nova senha (deixe em branco para não alterar)</label>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="input" />
      </div>
      {err && <div className="alert-inline err">{err}</div>}
      {ok  && <div className="alert-inline ok">{ok}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} className="btn primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onDone} className="btn ghost">Cancelar</button>
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
    e.preventDefault(); setErr(''); setOk(''); setLoading(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email: email || null, password, role, workday_hours: workdayHours, lunch_break_minutes: lunchMin, hourly_rate: rate || null }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(`${name} adicionado!`)
    setName(''); setUsername(''); setEmail(''); setPassword(''); setRole('employee')
    setWorkdayHours('8'); setLunchMin('60'); setRate('')
    setLoading(false); onRefresh()
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(`Desativar ${empName}?`)) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); setErr(data.error ?? 'Erro ao remover funcionário.'); return }
    onRefresh()
  }

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{employees.length} ativo(s)</SL>
          {err && <div className="alert-inline err" style={{ marginBottom: 12 }}>{err}</div>}
          {employees.map(emp => (
            <div key={emp.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`avatar size-28 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {emp.name}
                      {emp.role === 'admin' && <span className="chip accent" style={{ fontSize: 10 }}>Admin</span>}
                      {emp.role === 'manager' && <span className="chip accent" style={{ fontSize: 10 }}>Gerente</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      @{emp.username} · {emp.workday_hours}h ·{' '}
                      {emp.lunch_break_minutes > 0 ? `${emp.lunch_break_minutes}min almoço` : 'sem desconto'}
                      {emp.hourly_rate != null && ` · €${Number(emp.hourly_rate).toFixed(2)}/h`}
                      {emp.email && ` · ${emp.email}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingId(editingId === emp.id ? null : emp.id)} className="btn ghost sm icon" title="Configurações">⚙</button>
                  {emp.username !== 'admin' && (
                    <button onClick={() => handleRemove(emp.id, emp.name)} className="btn danger sm">Remover</button>
                  )}
                </div>
              </div>
              {editingId === emp.id && (
                <EmployeeSettings emp={emp} onDone={() => { setEditingId(null); onRefresh() }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Novo funcionário</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="form-grid-2">
              <div className="field"><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Maria Silva" className="input" required /></div>
              <div className="field"><label>Usuário</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="maria.silva" className="input" required /></div>
            </div>
            <div className="field">
              <label>Email (opcional)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
            </div>
            <div className="form-grid-2">
              <div className="field"><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 chars" className="input" required /></div>
              <div className="field">
                <label>Perfil</label>
                <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
                  <option value="employee">Funcionário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="form-grid-3">
              <div className="field">
                <label>Jornada</label>
                <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
                  {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
              <div className="field">
                <label>Almoço</label>
                <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
                  <option value="0">Sem desconto</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                </select>
              </div>
              <div className="field">
                <label>€/hora</label>
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Opcional" className="input" />
              </div>
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={loading} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Adicionando...' : '+ Adicionar'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
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
        setRecords(await res.json()); setLoaded(true)
        setTruncated(res.headers.get('X-Truncated') === 'true')
      } else { const data = await res.json(); setError(data.error ?? 'Erro ao gerar relatório.') }
    } catch { setError('Erro ao conectar.') }
    finally { setLoading(false) }
  }

  const byEmp: Record<string, { name: string; records: PunchRecord[] }> = {}
  records.forEach(r => {
    if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { name: r.employee_name, records: [] }
    byEmp[r.employee_id].records.push(r)
  })

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Período</SL>
          <div className="form-grid-2">
            <div className="field"><label>De</label><input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" /></div>
            <div className="field"><label>Até</label><input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" /></div>
          </div>
          <div className="field">
            <label>Funcionário</label>
            <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)} className="input">
              <option value="all">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {error && <div className="alert-inline err">{error}</div>}
          <button onClick={load} disabled={loading} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {loaded && !loading && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            {truncated && (
              <div className="alert-inline warn" style={{ marginBottom: 12 }}>
                Resultado limitado a 2000 registros. Refine o período.
              </div>
            )}
            {records.length === 0
              ? <div className="alert-inline info">Nenhum registro no período.</div>
              : (
                <>
                  <SL>{Object.keys(byEmp).length} pessoa(s) · {records.length} registros</SL>
                  {Object.entries(byEmp).map(([empId, { name, records: recs }]) => {
                    const emp = employees.find(e => e.id === empId)
                    const overtime = calcOvertimePeriod(recs)
                    return (
                      <div key={empId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{recs.length} registros</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{calcHours(recs)}</div>
                          {overtime !== null && (
                            <span className={`chip ${overtime >= 0 ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>
                              {overtime >= 0 ? '+' : ''}{fmtMinutes(Math.abs(overtime))}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => openPayslip(name, `${from} a ${to}`, recs, emp?.workday_hours ?? 8, emp?.lunch_break_minutes ?? 60, emp?.hourly_rate ?? null)}
                          className="btn ghost sm icon" title="Gerar holerite PDF"
                        >📄</button>
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
                      <div style={{ marginTop: 20 }}>
                        <SL>Horas por dia</SL>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
                          {chartData.map(({ date, min }) => {
                            const pct = Math.min(100, (min / maxMin) * 100)
                            const d = new Date(date + 'T12:00:00')
                            const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
                            return (
                              <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                                <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: pct > 0 ? `${pct}%` : 3, background: min === 0 ? 'var(--border)' : 'var(--accent)', opacity: min === 0 ? 1 : 0.5 }} />
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
                    const targetEmps = filterEmpId === 'all' ? employees : employees.filter(e => e.id === filterEmpId)
                    const presentDates = new Map<string, Set<string>>()
                    records.forEach(r => {
                      if (!presentDates.has(r.employee_id)) presentDates.set(r.employee_id, new Set())
                      presentDates.get(r.employee_id)!.add(r.date)
                    })
                    const absences = targetEmps
                      .map(emp => ({ empName: emp.name, dates: workingDays.filter(d => !presentDates.get(emp.id)?.has(d)) }))
                      .filter(a => a.dates.length > 0)
                    return (
                      <div style={{ marginTop: 20 }}>
                        <SL>Faltas / Ausências</SL>
                        {absences.length === 0
                          ? <div className="alert-inline ok" style={{ fontSize: 12 }}>Sem ausências no período.</div>
                          : absences.map(({ empName, dates }) => (
                            <div key={empName} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 4 }}>
                                {empName} <span style={{ color: 'var(--danger-fg)' }}>({dates.length} falta{dates.length > 1 ? 's' : ''})</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {dates.map(d => {
                                  const dt = new Date(d + 'T12:00:00')
                                  return (
                                    <span key={d} className="chip danger" style={{ fontSize: 10 }}>
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

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                  <button
                    onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`, employees.map(e => ({ id: e.id, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })))}
                    className="btn primary" style={{ width: '100%', justifyContent: 'center' }}
                  >
                    ⬇ Exportar CSV
                  </button>
                </>
              )
            }
          </div>
        </div>
      )}
    </>
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
  const totalMonthMin = Object.values(byEmpMonth).reduce((sum, recs) => sum + Math.max(0, calcOvertimePeriod(recs, 0, 60) ?? 0), 0)

  if (loading) return <div className="card"><div style={{ padding: 20 }}><div className="alert-inline info">Carregando dashboard...</div></div></div>

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="kpi">
            <div className="kpi-label">Online agora</div>
            <div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{onlineNow}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Horas este mês</div>
            <div className="kpi-value">{totalMonthMin > 0 ? fmtMinutes(Math.round(totalMonthMin)) : '—'}</div>
          </div>
        </div>
      </div>

      {workingDays.length >= 2 && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            <SL>Horas por dia — {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</SL>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginTop: 8 }}>
              {chartData.map(({ date, min }) => {
                const pct = Math.min(100, (min / maxChartMin) * 100)
                const d = new Date(date + 'T12:00:00')
                const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
                const isToday = date === todayStr
                return (
                  <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                    <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: pct > 0 ? `${pct}%` : 3, background: min === 0 ? 'var(--border)' : isToday ? 'var(--success-fg)' : 'var(--accent)', opacity: min === 0 ? 1 : 0.5 }} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Funcionários — este mês</SL>
          {employees.map(emp => {
            const empRecs = byEmpMonth[emp.id] ?? []
            const monthMin = empRecs.length > 0 ? Math.max(0, calcOvertimePeriod(empRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
            const targetMin = emp.workday_hours * 60 * workingDays.length
            const pct = targetMin > 0 ? Math.min(100, (monthMin / targetMin) * 100) : 0
            const bank = bankBalances.get(emp.id)
            return (
              <div key={emp.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{emp.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{monthMin > 0 ? fmtMinutes(Math.round(monthMin)) : '—'}</span>
                    {bank !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: bank >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        banco: {bank >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bank))}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', borderRadius: 999, height: 4 }}>
                  <div style={{ height: 4, borderRadius: 999, width: `${pct}%`, background: pct >= 100 ? 'var(--success-fg)' : pct >= 75 ? 'var(--accent)' : 'var(--fg-subtle)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
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
    e.preventDefault(); setErr(''); setOk(''); setSaving(true)
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
    setOk('Ajuste registado!'); setMinutes(''); setReason(''); setSaving(false)
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
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Saldos actuais</SL>
          {employees.length === 0 && <div className="alert-inline info">Nenhum funcionário.</div>}
          {employees.map(emp => {
            const info = balances.get(emp.id)
            const bal = info?.balanceMin
            return (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--fg)' }}>{emp.name}</span>
                {bal !== undefined
                  ? <span style={{ fontSize: 13, fontWeight: 600, color: bal >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                      {bal >= 0 ? '+' : '-'}{Math.floor(Math.abs(bal) / 60)}h{String(Math.abs(bal) % 60).padStart(2, '0')}m
                    </span>
                  : <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>—</span>
                }
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Novo ajuste manual</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="field">
              <label>Funcionário</label>
              <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="input">
                <option value="">Selecionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="field">
                <label>Minutos (positivo = crédito)</label>
                <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="ex: 60 ou -30" className="input" />
              </div>
              <div className="field">
                <label>Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
              </div>
            </div>
            <div className="field">
              <label>Motivo</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ex: Banco de horas acordado" className="input" />
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={saving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Salvando...' : '+ Registar ajuste'}
            </button>
          </form>
        </div>
      </div>

      {selectedEmp && (() => {
        const adjs = balances.get(selectedEmp)?.adjustments ?? []
        if (adjs.length === 0) return null
        const empName = employees.find(e => e.id === selectedEmp)?.name ?? ''
        return (
          <div className="card">
            <div style={{ padding: '16px 20px' }}>
              <SL>Ajustes de {empName}</SL>
              {adjs.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg)' }}>{a.reason}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{a.date}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: a.minutes >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)', flexShrink: 0 }}>
                    {a.minutes >= 0 ? '+' : ''}{a.minutes}min
                  </span>
                  <button onClick={() => handleDelete(a.id)} className="btn danger sm icon">✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </>
  )
}

// ─── Feriados tab ─────────────────────────────────────────────────────────────
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
    e.preventDefault(); setErr(''); setOk(''); setSaving(true)
    const res = await fetch('/api/day-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, type, description: description.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao salvar.'); setSaving(false); return }
    setOk('Registado!'); setDescription(''); setSaving(false)
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
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Adicionar feriado / folga</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" required /></div>
              <div className="field">
                <label>Tipo</label>
                <select value={type} onChange={e => setType(e.target.value as 'holiday' | 'day_off')} className="input">
                  <option value="holiday">Feriado</option>
                  <option value="day_off">Folga</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Descrição</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Natal" className="input" required />
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={saving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Salvando...' : '+ Adicionar'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {loading
            ? <div className="alert-inline info">Carregando...</div>
            : exceptions.length === 0
            ? <div className="alert-inline info">Nenhum feriado ou folga registada.</div>
            : (
              <>
                <SL>{exceptions.length} registo(s)</SL>
                {exceptions.map(exc => (
                  <div key={exc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{exc.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                        {new Date(exc.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`chip ${exc.type === 'holiday' ? 'accent' : 'success'}`} style={{ fontSize: 10 }}>
                      {TYPE_LABEL[exc.type]}
                    </span>
                    <button onClick={() => handleDelete(exc.id)} className="btn danger sm icon">✕</button>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </div>
    </>
  )
}

// ─── Auditoria tab ────────────────────────────────────────────────────────────
const AUDIT_LABELS: Record<string, string> = {
  employee_create:              '👤 Funcionário criado',
  employee_update:              '✏ Funcionário atualizado',
  employee_delete:              '🗑 Funcionário desativado',
  record_create:                '➕ Registo criado',
  record_update:                '✏ Registo editado',
  record_delete:                '🗑 Registo apagado',
  punch_on_behalf:              '▶ Ponto registado por admin',
  hour_bank_adjustment:         '⚖ Ajuste banco de horas',
  hour_bank_adjustment_delete:  '🗑 Ajuste banco removido',
  day_exception_create:         '📅 Feriado/folga criado',
  day_exception_delete:         '🗑 Feriado/folga removido',
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
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Filtro</SL>
          <div className="field" style={{ marginTop: 4 }}>
            <label>Ação</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input">
              <option value="all">Todas as ações</option>
              {Object.entries(AUDIT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {loading
            ? <div className="alert-inline info">Carregando...</div>
            : logs.length === 0
            ? <div className="alert-inline info">Nenhum registo de auditoria.</div>
            : (
              <>
                <SL>{logs.length} evento(s)</SL>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                      {AUDIT_LABELS[log.action] ?? log.action}
                      {log.target_name && <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}> — {log.target_name}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                      por {log.actor_name} · {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </div>
    </>
  )
}

// ─── Missing exit banner ──────────────────────────────────────────────────────
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
    <div className="alert-inline warn" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {alerts.length} dia(s) sem saída registrada</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              {a.name} — {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="btn ghost sm icon">✕</button>
    </div>
  )
}

// ─── Admin page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showPwd, setShowPwd] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const isManager = user?.role === 'manager'
  const visibleTabs = isManager ? MANAGER_TABS : ALL_TABS

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('pg.theme', next)
  }

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      if (data.role === 'manager') setTab('meu_ponto')
    } catch { setFetchError(true) }
  }, [router])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) setEmployees(await res.json())
    } catch { /* employees ficam como estão */ }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('pg.theme')
    if (saved) setTheme(saved)
    setFetchError(false)
    loadUser()
    loadEmployees()
  }, [loadUser, loadEmployees])

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
        tab={tab} setTab={setTab} tabs={visibleTabs}
        user={user} onLogout={handleLogout} onChangePwd={() => setShowPwd(true)}
        theme={theme} toggleTheme={toggleTheme}
        mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)}
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
          {tab === 'auditoria'    && user.role === 'admin' && <AuditoriaTab />}
        </div>
      </div>
    </div>
  )
}
