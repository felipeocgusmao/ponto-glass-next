import { memo } from 'react'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { fmtMinutes, fmtEur } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
type WorkState = 'absent' | 'working' | 'lunch' | 'coffee' | 'out'

const PUNCH_LABEL_PT: Record<string, string> = {
  entrada: 'Entrada', 'saída': 'Saída',
  inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
  pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
}
const PUNCH_TONE: Record<string, string> = {
  entrada: 'success', fim_almoco: 'success', retorno_cafe: 'success',
  'saída': 'danger', inicio_almoco: 'warn', pausa_cafe: 'warn',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function ProgressRing({ pct, overtime, label }: { pct: number; overtime: boolean; label: string }) {
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
        {label}
      </text>
    </svg>
  )
}

function PlayIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> }
function StopIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function UtensilsIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> }
function CoffeeIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> }
function RefreshIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }

interface Props {
  user: EmployeeProfile
  state: WorkState
  since: string | null
  liveMin: number
  targetMin: number
  pct: number
  remaining: number
  overtime: number
  earnings: number | null
  hh: string
  mm: string
  ss: string
  greeting: string
  myRecs: PunchRecord[]
  punching: boolean
  punch: (type: PunchType) => void
  geoDistance: number | null
  setConfirmingOut: (v: boolean) => void
}

export const PontoTab = memo(function PontoTab({ user, state, since, liveMin, targetMin: _targetMin, pct, remaining, overtime, earnings, hh, mm, ss, greeting, myRecs, punching, punch, geoDistance, setConfirmingOut }: Props) {
  const { t } = useLang()
  const isPastStart = (() => {
    const now = new Date()
    const [startH = 8, startM = 0] = (user.expected_start ?? '08:00').split(':').map(Number)
    return now.getHours() * 60 + now.getMinutes() >= startH * 60 + startM
  })()

  return (
    <div className="emp-card">
      <div className="emp-greeting">
        <div className="emp-greeting-hi">
          {greeting},{' '}
          <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
        </div>
        <div className="emp-greeting-date" style={{ textTransform: 'capitalize' }}>
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
        </div>
      </div>

      <div className="emp-clock-wrap">
        <div className="emp-clock-time tnum mono">
          <span>{hh}</span><span className="emp-clock-sep">:</span><span>{mm}</span>
          <span className="emp-clock-sec">:{ss}</span>
        </div>
        <div className="emp-status" aria-live="polite" aria-atomic="true">
          {state === 'working' && since && <span className="chip success"><span className="dot"/>{t('ponto.status.working')} {fmtTime(since)}{remaining > 0 && ` · ${fmtMinutes(remaining)} restantes`}</span>}
          {state === 'lunch' && since && <span className="chip warn"><span className="dot"/>{t('ponto.status.lunch')} {fmtTime(since)}</span>}
          {state === 'coffee' && since && <span className="chip warn"><span className="dot"/>{t('ponto.status.coffee')} {fmtTime(since)}</span>}
          {state === 'out' && since && <span className="chip">{t('ponto.status.out')} {fmtTime(since)}</span>}
          {state === 'absent' && <span className="chip">{t('ponto.status.absent')}</span>}
        </div>
      </div>

      <div className="emp-progress">
        <ProgressRing pct={pct} overtime={overtime > 0} label={t('ponto.journey')}/>
        <div className="emp-stats">
          <div className="emp-stat primary">
            <span className="emp-stat-label">{t('ponto.worked')}</span>
            <span className="emp-stat-value">{fmtMinutes(liveMin)}</span>
          </div>
          <div className={`emp-stat ${overtime > 0 ? 'tone-warn' : ''}`}>
            <span className="emp-stat-label">{overtime > 0 ? t('ponto.overtime') : t('ponto.remaining')}</span>
            <span className="emp-stat-value">{overtime > 0 ? '+' + fmtMinutes(overtime) : fmtMinutes(remaining)}</span>
          </div>
          {earnings != null && (
            <div className="emp-stat tone-success">
              <span className="emp-stat-label">{t('ponto.daily_earnings')}</span>
              <span className="emp-stat-value">{fmtEur(earnings)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="emp-actions">
        {state === 'absent' && (
          <button className={`btn-emp primary-big${isPastStart ? ' pulse' : ''}`} onClick={() => punch('entrada')} disabled={punching}>
            <PlayIcon size={16}/> {punching ? t('ponto.registering') : t('ponto.punch_in')}
          </button>
        )}
        {state === 'working' && (
          <>
            <div className="emp-action-row">
              <button className="btn-emp warn" onClick={() => punch('inicio_almoco')} disabled={punching}><UtensilsIcon size={14}/> {t('ponto.lunch_start')}</button>
              <button className="btn-emp warn" onClick={() => punch('pausa_cafe')} disabled={punching}><CoffeeIcon size={14}/> {t('ponto.coffee_start')}</button>
            </div>
            <button className="btn-emp danger-big" onClick={() => setConfirmingOut(true)} disabled={punching}>
              <StopIcon size={14}/> {t('ponto.punch_out')}
            </button>
          </>
        )}
        {state === 'lunch' && (
          <button className="btn-emp primary-big" onClick={() => punch('fim_almoco')} disabled={punching}>
            <PlayIcon size={16}/> {punching ? t('ponto.registering') : t('ponto.lunch_end')}
          </button>
        )}
        {state === 'coffee' && (
          <button className="btn-emp primary-big" onClick={() => punch('retorno_cafe')} disabled={punching}>
            <PlayIcon size={16}/> {punching ? t('ponto.registering') : t('ponto.coffee_end')}
          </button>
        )}
        {state === 'out' && (
          <button className="btn-emp" onClick={() => punch('entrada')} disabled={punching}>
            <RefreshIcon size={14}/> {t('ponto.punch_again')}
          </button>
        )}
      </div>

      {geoDistance !== null && user.workplace_lat != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: geoDistance <= (user.max_distance_meters ?? 200) ? 'var(--success-fg)' : 'var(--fg-muted)',
          justifyContent: 'center', marginBottom: 4,
        }}>
          <span>📍</span>
          <span>
            {geoDistance <= (user.max_distance_meters ?? 200)
              ? t('geo.inside')
              : t('geo.distance_m').replace('{n}', String(geoDistance))}
          </span>
        </div>
      )}

      <div className="emp-history">
        <div className="emp-history-head">
          <span>{t('ponto.today_history')}</span>
          <span className="muted tnum" style={{ fontSize: 11 }}>
            {myRecs.length} {myRecs.length === 1 ? t('ponto.punch') : t('ponto.punches')}
          </span>
        </div>
        {myRecs.length === 0 ? (
          <div className="emp-history-empty">{t('ponto.no_punches')}</div>
        ) : (
          <div className="emp-history-list">
            {[...myRecs]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map(r => (
                <div key={r.id} className="emp-history-item">
                  <span className={`chip ${PUNCH_TONE[r.type] ?? ''} outline`}>{t(`punch.${r.type}` as Parameters<typeof t>[0]) || PUNCH_LABEL_PT[r.type] || r.type}</span>
                  <span className="muted tnum mono" style={{ marginLeft: 'auto', fontSize: 12 }}>{fmtTime(r.timestamp)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
})
