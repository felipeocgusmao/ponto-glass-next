'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { getWorkState, calcLiveMin, fmtMin, ProgressRing, getGeo } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'

function PlayIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><polygon points="5 3 19 12 5 21 5 3"/></svg> }
function StopIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function UtensilsIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> }
function CoffeeIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> }
function RefreshIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }

export function MeuPontoTab({ user }: { user: EmployeeProfile }) {
  const { t } = useLang()
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [now, setNow] = useState<Date | null>(null)
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const fetchSeq = useRef(0)

  const loadRecords = useCallback(async () => {
    const seq = ++fetchSeq.current
    const res = await fetch('/api/records?today=true')
    if (!res.ok) return
    const all: PunchRecord[] = await res.json()
    // Ignore out-of-order responses so a stale reload can't revert a newer state.
    if (seq === fetchSeq.current) setRecords(all.filter(r => r.employee_id === user.id))
  }, [user.id])

  useEffect(() => { loadRecords() }, [loadRecords])
  useEffect(() => {
    setNow(new Date())
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => { setReminderDismissed(false) }, [records])

  // Register SW + subscribe to push (so admin gets server-sent pushes too)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return
    navigator.serviceWorker.register('/sw.js').then(async reg => {
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'denied') return
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return
      }
      try {
        const existing = await reg.pushManager.getSubscription()
        const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        await fetch('/api/push-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
      } catch { /* non-critical */ }
    }).catch(() => {})
  }, [])

  // Local notification: 15-min warning + overtime
  useEffect(() => {
    if (!records.length) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const { state: ws } = getWorkState(records)
    if (ws !== 'working') return
    const liveM = calcLiveMin(records, user.lunch_break_minutes)
    const wMin = user.workday_hours * 60
    const rem = wMin - liveM
    const ot = liveM - wMin
    const today = new Date().toISOString().split('T')[0]
    const key15 = `pg.notif.warn15.${today}.${user.id}`
    const keyOt = `pg.notif.overtime.${today}.${user.id}`
    const notify = (title: string, body: string, tag: string) => {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: '/icon-192.svg', badge: '/icon-192.svg', tag })
      }).catch(() => {})
    }
    if (rem > 0 && rem <= 15 && !localStorage.getItem(key15)) {
      localStorage.setItem(key15, '1')
      notify('Hora de terminar em breve ⏱', `Faltam ${Math.round(rem)} min para completar a tua jornada.`, 'end-warning')
    }
    if (ot >= 1 && !localStorage.getItem(keyOt)) {
      localStorage.setItem(keyOt, '1')
      notify('Jornada concluída 🔔', 'Já completaste a jornada de hoje. Não te esqueças de registar a saída!', 'overtime-alert')
    }
  }, [now, records, user])

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--'
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--'
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--'
  const greeting = now && now.getHours() < 12 ? t('ponto.greeting.morning') : now && now.getHours() < 19 ? t('ponto.greeting.afternoon') : t('ponto.greeting.evening')

  const { state, since } = getWorkState(records)
  const isOut = state === 'off' && records.some(r => r.type === 'saída')
  const liveMin = calcLiveMin(records, user.lunch_break_minutes)
  const workdayMin = user.workday_hours * 60
  const pct = workdayMin > 0 ? Math.min(100, (liveMin / workdayMin) * 100) : 0
  const isOvertime = liveMin > workdayMin
  const remaining = Math.max(0, workdayMin - liveMin)
  const overtime = Math.max(0, liveMin - workdayMin)
  const earnings = user.hourly_rate != null ? (liveMin / 60) * Number(user.hourly_rate) : null

  const punch = async (type: string) => {
    setPunching(true)
    let lat: number | undefined, lng: number | undefined
    if (user.geo_mode !== 'disabled') {
      const geo = await getGeo()
      if (geo) { lat = geo.lat; lng = geo.lng }
      else if (user.geo_mode === 'required') {
        setToast({ kind: 'err', text: t('meu.geo_error') })
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
      setToast({ kind: 'err', text: data.error ?? t('punch.error_register') })
      setPunching(false); return
    }
    setToast({ kind: 'ok', text: t('meu.registered') })
    setPunching(false)
    // Optimistic update from the inserted record, so the state flips immediately
    // even if the follow-up reload is slow, fails, or arrives stale.
    if (data?.id) setRecords(prev => [...prev.filter(r => r.id !== data.id), data])
    loadRecords()
    setTimeout(() => setToast(null), 2500)
  }

  const tagLabel = (type: string): string => {
    const map: Record<string, string> = {
      entrada: t('punch.entrada'), 'saída': t('punch.saída'),
      inicio_almoco: t('punch.inicio_almoco'), fim_almoco: t('punch.fim_almoco'),
      pausa_cafe: t('punch.pausa_cafe'), retorno_cafe: t('punch.retorno_cafe'),
    }
    return map[type] ?? type
  }

  const PUNCH_TONE: Record<string, string> = {
    entrada: 'success', fim_almoco: 'success', retorno_cafe: 'success',
    'saída': 'danger', inicio_almoco: 'warn', pausa_cafe: 'warn',
  }

  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {toast && <div className={`alert-inline ${toast.kind}`}>{toast.text}</div>}

        {/* Overtime reminder banner */}
        {state === 'working' && overtime > 15 && !reminderDismissed && (
          <div style={{
            background: 'var(--warning-soft, rgba(234,179,8,0.12))',
            border: '1px solid var(--warning, #ca8a04)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>⏰</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{t('ponto.reminder')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                {t('ponto.reminder.body').replace('{n}', String(Math.round(overtime)))}
              </div>
            </div>
            <button onClick={() => setReminderDismissed(true)} className="btn ghost sm" style={{ flexShrink: 0, fontSize: 11 }}>
              {t('ponto.reminder.dismiss')}
            </button>
          </div>
        )}

        {/* Greeting + date */}
        <div>
          <div style={{ fontSize: 15, color: 'var(--fg-muted)', fontWeight: 400 }}>
            {greeting}, <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2, textTransform: 'capitalize' }}>
            {now ? now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' }) : ''}
          </div>
        </div>

        {/* Clock + status */}
        <div style={{ textAlign: 'center' }}>
          <div className="tnum mono" style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {hh}:{mm}<span style={{ fontSize: 24, color: 'var(--fg-muted)' }}>:{ss}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {state === 'working' && since && (
              <span className="chip success"><span className="dot" style={{ marginRight: 4 }}/>{t('ponto.status.working')} {since}</span>
            )}
            {state === 'lunch' && since && (
              <span className="chip warn"><span className="dot" style={{ marginRight: 4 }}/>{t('ponto.status.lunch')} {since}</span>
            )}
            {state === 'coffee' && since && (
              <span className="chip warn"><span className="dot" style={{ marginRight: 4 }}/>{t('ponto.status.coffee')} {since}</span>
            )}
            {isOut && since && (
              <span className="chip">{t('ponto.status.out')} {since}</span>
            )}
            {state === 'off' && !isOut && (
              <span className="chip">{t('ponto.status.absent')}</span>
            )}
          </div>
        </div>

        {/* Progress ring + stats */}
        <div className="emp-progress">
          <ProgressRing pct={pct} overtime={isOvertime} label={t('ponto.journey')} />
          <div className="emp-stats">
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('ponto.worked')}</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>{liveMin > 0 ? fmtMin(Math.round(liveMin)) : '0m'}</div>
            </div>
            <div style={isOvertime ? { color: 'var(--warning-fg)' } : {}}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isOvertime ? t('ponto.overtime') : t('ponto.remaining')}
              </div>
              <div className="tnum" style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                {isOvertime ? `+${fmtMin(Math.round(overtime))}` : fmtMin(Math.round(remaining))}
              </div>
            </div>
            {earnings != null && (
              <div style={{ color: 'var(--success-fg)' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('ponto.daily_earnings')}</div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                  {earnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="emp-actions">
          {state === 'off' && !isOut && (
            <button onClick={() => punch('entrada')} disabled={punching} className="btn-emp primary-big">
              <PlayIcon /> {punching ? t('ponto.registering') : t('ponto.punch_in')}
            </button>
          )}
          {state === 'working' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => punch('inicio_almoco')} disabled={punching} className="btn-emp warn" style={{ flex: 1 }}><UtensilsIcon /> {t('ponto.lunch_start')}</button>
                <button onClick={() => punch('pausa_cafe')} disabled={punching} className="btn-emp warn" style={{ flex: 1 }}><CoffeeIcon /> {t('ponto.coffee_start')}</button>
              </div>
              <button onClick={() => punch('saída')} disabled={punching} className="btn-emp danger-big">
                <StopIcon /> {punching ? t('ponto.registering') : t('ponto.punch_out')}
              </button>
            </>
          )}
          {state === 'lunch' && (
            <button onClick={() => punch('fim_almoco')} disabled={punching} className="btn-emp primary-big">
              <PlayIcon /> {punching ? t('ponto.registering') : t('ponto.lunch_end')}
            </button>
          )}
          {state === 'coffee' && (
            <button onClick={() => punch('retorno_cafe')} disabled={punching} className="btn-emp primary-big">
              <PlayIcon /> {punching ? t('ponto.registering') : t('ponto.coffee_end')}
            </button>
          )}
          {isOut && (
            <button onClick={() => punch('entrada')} disabled={punching} className="btn-emp">
              <RefreshIcon /> {t('ponto.punch_again')}
            </button>
          )}
        </div>

        {/* Today's history */}
        <div className="emp-history">
          <div className="emp-history-head">
            <span>{t('ponto.today_history')}</span>
            <span className="tnum" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
              {sorted.length} {sorted.length === 1 ? t('ponto.punch') : t('ponto.punches')}
            </span>
          </div>
          {sorted.length === 0
            ? <div className="emp-history-empty">{t('ponto.no_punches')}</div>
            : (
              <div className="emp-history-list">
                {sorted.map(r => (
                  <div key={r.id} className="emp-history-item">
                    <span className={`chip ${PUNCH_TONE[r.type] ?? ''} outline`} style={{ fontSize: 11 }}>
                      {tagLabel(r.type)}
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
