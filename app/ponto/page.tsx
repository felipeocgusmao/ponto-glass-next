'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { calcTimeBreakdown, calcNetMinutes, WORKING_TYPES } from '@/lib/utils'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
type WorkState = 'absent' | 'working' | 'lunch' | 'coffee' | 'out'

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
  if (state === 'working' && since) {
    return Math.round(base + (Date.now() - new Date(since).getTime()) / 60_000)
  }
  return Math.round(base)
}

function fmtMin(min: number): string {
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = min < 0 ? '-' : ''
  if (h === 0) return `${sign}${m}m`
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`
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

export default function PontoPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [now, setNow] = useState(new Date())
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState('')
  const [fetchError, setFetchError] = useState(false)
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

  useEffect(() => { loadUser(); loadRecords() }, [loadUser, loadRecords])
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  useEffect(() => {
    const saved = localStorage.getItem('pg.theme') as 'dark' | 'light' | null
    if (saved) setTheme(saved)
  }, [])

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

  return (
    <div className="emp-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="emp-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.svg" width="26" height="26" alt="" style={{ borderRadius: 6 }} />
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

      <main className="emp-main">
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
                <span className="emp-stat-value">{fmtMin(liveMin)}</span>
              </div>
              <div className={`emp-stat ${overtime > 0 ? 'tone-warn' : ''}`}>
                <span className="emp-stat-label">{overtime > 0 ? 'Horas extras' : 'Restam'}</span>
                <span className="emp-stat-value">{overtime > 0 ? '+' + fmtMin(overtime) : fmtMin(remaining)}</span>
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
      </main>
    </div>
  )
}
