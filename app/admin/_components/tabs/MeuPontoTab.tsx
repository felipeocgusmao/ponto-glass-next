'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { getWorkState, calcLiveMin, fmtMin, ProgressRing, getGeo } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'

export function MeuPontoTab({ user }: { user: EmployeeProfile }) {
  const { t } = useLang()
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
      setToast({ kind: 'err', text: data.error ?? 'Erro ao registrar.' })
      setPunching(false); return
    }
    setToast({ kind: 'ok', text: t('meu.registered') })
    setPunching(false)
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
              {state === 'working' ? t('meu.on_duty') : state === 'lunch' ? t('meu.at_lunch') : state === 'coffee' ? t('meu.coffee') : t('meu.off')}
            </span>
          </div>
        </div>

        <div className="emp-progress">
          <ProgressRing pct={pct} overtime={isOvertime} />
          <div className="emp-stats">
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('meu.worked')}</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>{liveMin > 0 ? fmtMin(Math.round(liveMin)) : '0m'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('meu.goal')}</div>
              <div className="tnum" style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-muted)', marginTop: 2 }}>{fmtMin(workdayMin)}</div>
            </div>
          </div>
        </div>

        <div className="emp-actions">
          {state === 'off' && (
            <button onClick={() => punch('entrada')} disabled={punching} className="btn-emp primary-big">
              {punching ? '…' : t('meu.register_in')}
            </button>
          )}
          {state === 'working' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => punch('inicio_almoco')} disabled={punching} className="btn-emp warn">{t('meu.at_lunch')}</button>
              <button onClick={() => punch('pausa_cafe')} disabled={punching} className="btn-emp warn">{t('meu.coffee')}</button>
              <button onClick={() => punch('saída')} disabled={punching} className="btn-emp danger-big" style={{ flex: 2 }}>{t('status.clock_out')}</button>
            </div>
          )}
          {state === 'lunch' && (
            <button onClick={() => punch('fim_almoco')} disabled={punching} className="btn-emp warn">{t('meu.return_lunch')}</button>
          )}
          {state === 'coffee' && (
            <button onClick={() => punch('retorno_cafe')} disabled={punching} className="btn-emp warn">{t('meu.return_coffee')}</button>
          )}
        </div>

        <div className="emp-history">
          <div className="emp-history-head"><span>{t('meu.today')}</span></div>
          {sorted.length === 0
            ? <div className="emp-history-empty">{t('meu.no_records')}</div>
            : (
              <div className="emp-history-list">
                {sorted.map(r => (
                  <div key={r.id} className="emp-history-item">
                    <span className={`chip ${r.type === 'entrada' ? 'success' : r.type === 'saída' ? 'danger' : 'warn'}`} style={{ fontSize: 11 }}>
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
