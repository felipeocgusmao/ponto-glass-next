'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { calcTimeBreakdown, calcNetMinutes, WORKING_TYPES, fmtMinutes, openPayslip } from '@/lib/utils'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
type WorkState = 'absent' | 'working' | 'lunch' | 'coffee' | 'out'
type Tab = 'ponto' | 'historico' | 'banco' | 'correcoes'

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
interface CorrReq { id: string; req_type: string; req_timestamp: string; req_date: string; reason: string | null; status: CorrectionStatus; reviewer_note: string | null; created_at: string }

const PUNCH_LABEL: Record<string, string> = {
  entrada: 'Entrada', 'saída': 'Saída',
  inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
  pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
}
const PUNCH_TONE: Record<string, string> = {
  entrada: 'success', fim_almoco: 'success', retorno_cafe: 'success',
  'saída': 'danger', inicio_almoco: 'warn', pausa_cafe: 'warn',
}

function getWorkState(recs: PunchRecord[]): { state: WorkState; since: string | null } {
  if (!recs.length) return { state: 'absent', since: null }
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted[sorted.length - 1]
  if (WORKING_TYPES.includes(last.type)) return { state: 'working', since: last.timestamp }
  if (last.type === 'inicio_almoco') return { state: 'lunch', since: last.timestamp }
  if (last.type === 'pausa_cafe') return { state: 'coffee', since: last.timestamp }
  if (last.type === 'saída') return { state: 'out', since: last.timestamp }
  return { state: 'absent', since: null }
}

function calcLiveMin(recs: PunchRecord[], lunchAuto: number): number {
  const { state, since } = getWorkState(recs)
  const hasBreaks = recs.some(r => ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe'].includes(r.type))
  const base = hasBreaks ? calcTimeBreakdown(recs).workedMin : calcNetMinutes(recs, lunchAuto)
  if (state === 'working' && since)
    return Math.round(base + (Date.now() - new Date(since).getTime()) / 60_000)
  return Math.round(base)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function empColor(id: string): number {
  return (id.charCodeAt(0) % 8) + 1
}

function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    )
  })
}

function ProgressRing({ pct, overtime }: { pct: number; overtime: boolean }) {
  const r = 56, c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <svg viewBox="-70 -70 140 140" className="emp-ring">
      <circle cx="0" cy="0" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8"/>
      <circle cx="0" cy="0" r={r} fill="none"
        stroke={overtime ? 'var(--warning)' : 'var(--accent)'}
        strokeWidth="8" strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90)" strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}/>
      <text x="0" y="2" textAnchor="middle" dominantBaseline="middle"
        fontSize="20" fontWeight="600" fill="var(--fg)"
        fontFamily="var(--font-mono)" letterSpacing="-0.04em">
        {Math.round(pct)}%
      </text>
      <text x="0" y="20" textAnchor="middle" fontSize="9"
        fill="var(--fg-subtle)" fontWeight="600" letterSpacing="0.06em">
        JORNADA
      </text>
    </svg>
  )
}

function SunIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function LogoutIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function PlayIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> }
function StopIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function UtensilsIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> }
function CoffeeIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> }
function RefreshIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }
function ClockIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> }
function HistoryIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function BankIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg> }
function EditIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }

export default function PontoPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [now, setNow] = useState(new Date())
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState('')
  const [fetchError, setFetchError] = useState(false)
  const [tab, setTab] = useState<Tab>('ponto')

  // history tab state
  const [historyRecs, setHistoryRecs] = useState<PunchRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // bank tab state
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankLoaded, setBankLoaded] = useState(false)

  // corrections tab state
  const [corrList, setCorrList] = useState<CorrReq[]>([])
  const [corrLoaded, setCorrLoaded] = useState(false)
  const [corrLoading, setCorrLoading] = useState(false)
  const [corrDate, setCorrDate] = useState(() => new Date().toISOString().split('T')[0])
  const [corrTime, setCorrTime] = useState(() => { const n = new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}` })
  const [corrType, setCorrType] = useState('entrada')
  const [corrReason, setCorrReason] = useState('')
  const [corrSubmitting, setCorrSubmitting] = useState(false)
  const [corrMsg, setCorrMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const router = useRouter()

  const loadUser = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
    } catch { setFetchError(true) }
  }, [router])

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* keep */ }
  }, [])

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return
    setHistoryLoading(true)
    try {
      const now = new Date()
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const to = now.toISOString().split('T')[0]
      const res = await fetch(`/api/reports?from=${from}&to=${to}`)
      if (res.ok) { setHistoryRecs(await res.json()); setHistoryLoaded(true) }
    } catch { /* keep */ }
    finally { setHistoryLoading(false) }
  }, [historyLoaded])

  const loadBank = useCallback(async () => {
    if (bankLoaded) return
    setBankLoading(true)
    try {
      const res = await fetch('/api/hour-bank')
      if (res.ok) { const d = await res.json(); setBankBalance(d.balanceMin); setBankLoaded(true) }
    } catch { /* keep */ }
    finally { setBankLoading(false) }
  }, [bankLoaded])

  const loadCorrections = useCallback(async () => {
    if (corrLoaded) return
    setCorrLoading(true)
    try {
      const res = await fetch('/api/correction-requests')
      if (res.ok) { setCorrList(await res.json()); setCorrLoaded(true) }
    } catch { /* keep */ }
    finally { setCorrLoading(false) }
  }, [corrLoaded])

  const submitCorrection = async () => {
    if (!corrDate || !corrTime || !corrType) return
    setCorrSubmitting(true); setCorrMsg(null)
    try {
      const timestamp = `${corrDate}T${corrTime}:00`
      const res = await fetch('/api/correction-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: corrType, timestamp, reason: corrReason || undefined }),
      })
      if (res.ok) {
        setCorrMsg({ ok: true, text: 'Pedido enviado. Aguarde aprovação do administrador.' })
        setCorrReason('')
        setCorrLoaded(false) // force reload
        await loadCorrections()
      } else {
        const d = await res.json()
        setCorrMsg({ ok: false, text: d.error ?? 'Erro ao enviar pedido.' })
      }
    } catch { setCorrMsg({ ok: false, text: 'Erro de conexão.' }) }
    finally { setCorrSubmitting(false) }
  }

  useEffect(() => { loadUser(); loadRecords() }, [loadUser, loadRecords])
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  useEffect(() => {
    const saved = localStorage.getItem('pg.theme') as 'dark' | 'light' | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    if (tab === 'historico') loadHistory()
    if (tab === 'banco') loadBank()
    if (tab === 'correcoes') loadCorrections()
  }, [tab, loadHistory, loadBank, loadCorrections])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('pg.theme', next)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const punch = async (type: PunchType) => {
    if (!user || punching) return
    setPunching(true)
    const geoMode = user.geo_mode ?? 'optional'
    let geo: { lat: number; lng: number } | null = null
    if (geoMode !== 'disabled') {
      geo = await getGeo()
      if (geoMode === 'required' && !geo) {
        showToast('Localização obrigatória. Permita o acesso.')
        setPunching(false)
        return
      }
    }
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}) }),
      })
      if (res.ok) {
        await loadRecords()
        setHistoryLoaded(false) // invalidate history cache
        showToast(type === 'entrada' ? 'Entrada registrada' : type === 'saída' ? 'Saída registrada' : PUNCH_LABEL[type])
      } else {
        const d = await res.json()
        showToast(d.error ?? 'Erro ao registrar')
      }
    } catch { showToast('Erro de conexão') }
    finally { setPunching(false) }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (fetchError) return (
    <div className="emp-shell">
      <main className="emp-main">
        <div className="emp-card" style={{ textAlign: 'center', gap: 16 }}>
          <div className="muted">Erro ao conectar. Verifique sua conexão.</div>
          <button onClick={() => { setFetchError(false); loadUser(); loadRecords() }} className="btn primary">
            Tentar novamente
          </button>
        </div>
      </main>
    </div>
  )

  if (!user) return (
    <div className="emp-shell">
      <main className="emp-main">
        <div style={{ fontSize: 40, opacity: 0.2, fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>…</div>
      </main>
    </div>
  )

  const myRecs = records.filter(r => r.employee_id === user.id)
  const { state, since } = getWorkState(myRecs)
  const liveMin = calcLiveMin(myRecs, user.lunch_break_minutes)
  const targetMin = user.workday_hours * 60
  const pct = Math.min(100, (liveMin / targetMin) * 100)
  const remaining = Math.max(0, targetMin - liveMin)
  const overtime = Math.max(0, liveMin - targetMin)
  const earnings = user.hourly_rate ? (liveMin / 60) * user.hourly_rate : null

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 19 ? 'Boa tarde' : 'Boa noite'

  // ── History tab helpers ──────────────────────────────────────────────────────
  const byDay = new Map<string, PunchRecord[]>()
  historyRecs.forEach(r => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a))
  const totalMonthMin = sortedDays.reduce((sum, date) => {
    const recs = byDay.get(date)!
    const hasBreaks = recs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
    return sum + Math.max(0, hasBreaks ? calcTimeBreakdown(recs).workedMin : calcNetMinutes(recs, user.lunch_break_minutes))
  }, 0)

  return (
    <div className="emp-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="emp-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.svg" width="26" height="26" alt="" style={{ borderRadius: 6, flexShrink: 0 }} />
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>PontoGlass</div>
        </div>
        <div className="emp-user-menu">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            {theme === 'dark' ? <SunIcon size={14}/> : <MoonIcon size={14}/>}
          </button>
          <div className="emp-user-info">
            <div className="emp-user-name">{user.name}</div>
            <div className="emp-user-role">@{user.username} · Funcionário</div>
          </div>
          <div className={`avatar size-36 av-c${empColor(user.id)}`}>{initials(user.name)}</div>
          <button className="btn ghost sm icon" onClick={handleLogout} title="Sair">
            <LogoutIcon size={14}/>
          </button>
        </div>
      </header>

      <main className="emp-main" style={{ paddingBottom: 72 }}>

        {/* ── PONTO TAB ─────────────────────────────────────────────────────── */}
        {tab === 'ponto' && (
          <div className="emp-card">
            <div className="emp-greeting">
              <div className="emp-greeting-hi">
                {greeting},{' '}
                <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
              </div>
              <div className="emp-greeting-date" style={{ textTransform: 'capitalize' }}>
                {now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </div>
            </div>

            <div className="emp-clock-wrap">
              <div className="emp-clock-time tnum mono">
                <span>{hh}</span><span className="emp-clock-sep">:</span><span>{mm}</span>
                <span className="emp-clock-sec">:{ss}</span>
              </div>
              <div className="emp-status">
                {state === 'working' && since && <span className="chip success"><span className="dot"/>Trabalhando · desde {fmtTime(since)}</span>}
                {state === 'lunch' && since && <span className="chip warn"><span className="dot"/>Em almoço · desde {fmtTime(since)}</span>}
                {state === 'coffee' && since && <span className="chip warn"><span className="dot"/>Em pausa · desde {fmtTime(since)}</span>}
                {state === 'out' && since && <span className="chip">Encerrou às {fmtTime(since)}</span>}
                {state === 'absent' && <span className="chip">Não iniciou o expediente</span>}
              </div>
            </div>

            <div className="emp-progress">
              <ProgressRing pct={pct} overtime={overtime > 0}/>
              <div className="emp-stats">
                <div className="emp-stat primary">
                  <span className="emp-stat-label">Trabalhadas</span>
                  <span className="emp-stat-value">{fmtMinutes(liveMin)}</span>
                </div>
                <div className={`emp-stat ${overtime > 0 ? 'tone-warn' : ''}`}>
                  <span className="emp-stat-label">{overtime > 0 ? 'Horas extras' : 'Restam'}</span>
                  <span className="emp-stat-value">{overtime > 0 ? '+' + fmtMinutes(overtime) : fmtMinutes(remaining)}</span>
                </div>
                {earnings != null && (
                  <div className="emp-stat tone-success">
                    <span className="emp-stat-label">Ganhos do dia</span>
                    <span className="emp-stat-value">{fmtEur(earnings)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="emp-actions">
              {state === 'absent' && (
                <button className="btn-emp primary-big" onClick={() => punch('entrada')} disabled={punching}>
                  <PlayIcon size={16}/> {punching ? 'Registrando…' : 'Bater entrada'}
                </button>
              )}
              {state === 'working' && (
                <>
                  <div className="emp-action-row">
                    <button className="btn-emp warn" onClick={() => punch('inicio_almoco')} disabled={punching}><UtensilsIcon size={14}/> Almoço</button>
                    <button className="btn-emp warn" onClick={() => punch('pausa_cafe')} disabled={punching}><CoffeeIcon size={14}/> Pausa</button>
                  </div>
                  <button className="btn-emp danger-big" onClick={() => punch('saída')} disabled={punching}>
                    <StopIcon size={14}/> {punching ? 'Registrando…' : 'Bater saída'}
                  </button>
                </>
              )}
              {state === 'lunch' && (
                <button className="btn-emp primary-big" onClick={() => punch('fim_almoco')} disabled={punching}>
                  <PlayIcon size={16}/> {punching ? 'Registrando…' : 'Voltei do almoço'}
                </button>
              )}
              {state === 'coffee' && (
                <button className="btn-emp primary-big" onClick={() => punch('retorno_cafe')} disabled={punching}>
                  <PlayIcon size={16}/> {punching ? 'Registrando…' : 'Voltei da pausa'}
                </button>
              )}
              {state === 'out' && (
                <button className="btn-emp" onClick={() => punch('entrada')} disabled={punching}>
                  <RefreshIcon size={14}/> Bater entrada novamente
                </button>
              )}
            </div>

            <div className="emp-history">
              <div className="emp-history-head">
                <span>Histórico de hoje</span>
                <span className="muted tnum" style={{ fontSize: 11 }}>
                  {myRecs.length} {myRecs.length === 1 ? 'batida' : 'batidas'}
                </span>
              </div>
              {myRecs.length === 0 ? (
                <div className="emp-history-empty">Nenhuma batida ainda — use o botão acima.</div>
              ) : (
                <div className="emp-history-list">
                  {[...myRecs]
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map(r => (
                      <div key={r.id} className="emp-history-item">
                        <span className={`chip ${PUNCH_TONE[r.type] ?? ''} outline`}>{PUNCH_LABEL[r.type] ?? r.type}</span>
                        <span className="muted tnum mono" style={{ marginLeft: 'auto', fontSize: 12 }}>{fmtTime(r.timestamp)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTÓRICO TAB ─────────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <div className="emp-card">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 8 }}>
                {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </div>
              {totalMonthMin > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>{fmtMinutes(totalMonthMin)}</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>trabalhadas este mês</span>
                </div>
              )}
            </div>

            {historyLoading && <div className="alert-inline info">Carregando...</div>}

            {!historyLoading && sortedDays.length === 0 && (
              <div className="alert-inline info">Nenhum registo este mês.</div>
            )}

            {!historyLoading && historyRecs.length > 0 && (
              <button
                className="btn-emp"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                onClick={() => {
                  const period = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
                  openPayslip(user.name, period, historyRecs, user.workday_hours, user.lunch_break_minutes, user.hourly_rate)
                }}
              >
                📄 Exportar holerite do mês
              </button>
            )}

            {sortedDays.map(date => {
              const recs = byDay.get(date)!.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              const hasBreaks = recs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
              const dayMin = Math.max(0, hasBreaks ? calcTimeBreakdown(recs).workedMin : calcNetMinutes(recs, user.lunch_break_minutes))
              const dt = new Date(date + 'T12:00:00')
              const isToday = date === new Date().toISOString().split('T')[0]
              return (
                <div key={date} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--fg)', textTransform: 'capitalize' }}>
                        {dt.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </span>
                      {isToday && <span className="chip accent" style={{ fontSize: 9, marginLeft: 6 }}>hoje</span>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: dayMin > 0 ? 'var(--fg)' : 'var(--fg-subtle)' }}>
                      {dayMin > 0 ? fmtMinutes(dayMin) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {recs.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className={`chip ${PUNCH_TONE[r.type] ?? ''} outline`} style={{ fontSize: 10 }}>
                          {PUNCH_LABEL[r.type] ?? r.type}
                        </span>
                        <span className="muted tnum" style={{ fontSize: 10 }}>{fmtTime(r.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── BANCO TAB ─────────────────────────────────────────────────────── */}
        {tab === 'banco' && (
          <div className="emp-card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16 }}>
              Banco de horas
            </div>

            {bankLoading && <div className="alert-inline info">Carregando...</div>}

            {!bankLoading && bankBalance !== null && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{
                  fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: bankBalance >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)',
                  letterSpacing: '-0.03em',
                }}>
                  {bankBalance >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bankBalance))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 8 }}>
                  {bankBalance >= 0
                    ? 'Tem horas a favor acumuladas'
                    : 'Tem horas em débito'}
                </div>
                <div style={{ marginTop: 24, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-muted)', textAlign: 'left' }}>
                  O banco de horas acumula as diferenças entre as horas trabalhadas e a jornada prevista, incluindo ajustes manuais feitos pelo administrador.
                </div>
              </div>
            )}

            {!bankLoading && bankBalance === null && (
              <div className="alert-inline info">Não foi possível carregar o saldo.</div>
            )}
          </div>
        )}
        {/* ── CORREÇÕES TAB ─────────────────────────────────────────────── */}
        {tab === 'correcoes' && (
          <div className="emp-card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16 }}>
              Pedir correção de batida
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div className="field">
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data</label>
                <input type="date" className="input" value={corrDate} onChange={e => setCorrDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</label>
                  <select className="input" value={corrType} onChange={e => setCorrType(e.target.value)}>
                    <option value="entrada">Entrada</option>
                    <option value="saída">Saída</option>
                    <option value="inicio_almoco">Início almoço</option>
                    <option value="fim_almoco">Fim almoço</option>
                    <option value="pausa_cafe">Pausa café</option>
                    <option value="retorno_cafe">Retorno café</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hora</label>
                  <input type="time" className="input" value={corrTime} onChange={e => setCorrTime(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Motivo (opcional)</label>
                <input type="text" className="input" value={corrReason} onChange={e => setCorrReason(e.target.value)} placeholder="Ex: Esqueci de bater saída" />
              </div>

              {corrMsg && (
                <div className={`alert-inline ${corrMsg.ok ? 'ok' : 'err'}`}>{corrMsg.text}</div>
              )}

              <button className="btn-emp primary-big" onClick={submitCorrection} disabled={corrSubmitting}>
                {corrSubmitting ? 'Enviando…' : 'Enviar pedido'}
              </button>
            </div>

            {corrLoading && <div className="alert-inline info">Carregando...</div>}

            {corrLoaded && corrList.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12 }}>
                  Meus pedidos
                </div>
                {corrList.map(cr => {
                  const PUNCH_LABEL: Record<string, string> = { entrada: 'Entrada', 'saída': 'Saída', inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço', pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café' }
                  const d = new Date(cr.req_timestamp)
                  const dateStr = cr.req_date.split('-').reverse().join('/')
                  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={cr.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{PUNCH_LABEL[cr.req_type] ?? cr.req_type} · {dateStr} {timeStr}</span>
                        <span className={`chip ${cr.status === 'approved' ? 'success' : cr.status === 'rejected' ? 'danger' : 'warn'}`} style={{ fontSize: 10 }}>
                          {cr.status === 'approved' ? 'aprovado' : cr.status === 'rejected' ? 'rejeitado' : 'pendente'}
                        </span>
                      </div>
                      {cr.reason && <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontStyle: 'italic' }}>"{cr.reason}"</div>}
                      {cr.reviewer_note && <div style={{ fontSize: 11, color: 'var(--danger-fg)', marginTop: 2 }}>Nota: "{cr.reviewer_note}"</div>}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── BOTTOM TAB BAR ──────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
        background: 'var(--sidebar-bg)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        backdropFilter: 'blur(12px)', zIndex: 50,
      }}>
        {([
          { id: 'ponto',     label: 'Ponto',     Icon: ClockIcon },
          { id: 'historico', label: 'Histórico', Icon: HistoryIcon },
          { id: 'banco',     label: 'Banco',     Icon: BankIcon },
          { id: 'correcoes', label: 'Correção',  Icon: EditIcon },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
              color: tab === id ? 'var(--accent)' : 'var(--fg-muted)',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: tab === id ? 600 : 400, letterSpacing: '0.02em' }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
