'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, PunchRecord } from '@/lib/types'
import { WORKING_TYPES, calcTimeBreakdown, calcNetMinutes, fmtMinutes } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'

type WorkState = 'working' | 'pause' | 'out' | 'absent'
type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'

function getState(recs: PunchRecord[]): WorkState {
  if (!recs.length) return 'absent'
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted[sorted.length - 1]
  if (WORKING_TYPES.includes(last.type)) return 'working'
  if (last.type === 'inicio_almoco' || last.type === 'pausa_cafe') return 'pause'
  if (last.type === 'saída') return 'out'
  return 'absent'
}

function calcDayMin(recs: PunchRecord[], lunchMin: number): number {
  const hasBreaks = recs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
  if (hasBreaks) return calcTimeBreakdown(recs).workedMin
  return Math.max(0, calcNetMinutes(recs, lunchMin))
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function empColor(id: string): number {
  return (id.charCodeAt(0) % 8) + 1
}

const PUNCH_OPTIONS: { type: PunchType; tone: string; labelKey: string }[] = [
  { type: 'entrada',       tone: 'success', labelKey: 'punch.entrada'       },
  { type: 'saída',         tone: 'danger',  labelKey: 'punch.saída'         },
  { type: 'inicio_almoco', tone: 'warn',    labelKey: 'punch.inicio_almoco' },
  { type: 'fim_almoco',    tone: 'success', labelKey: 'punch.fim_almoco'    },
  { type: 'pausa_cafe',    tone: 'warn',    labelKey: 'punch.pausa_cafe'    },
  { type: 'retorno_cafe',  tone: 'success', labelKey: 'punch.retorno_cafe'  },
]

const STATE_STYLE: Record<WorkState, { chip: string; dot: string }> = {
  working: { chip: 'success', dot: '#22c55e' },
  pause:   { chip: 'warn',    dot: '#eab308' },
  out:     { chip: '',        dot: '#94a3b8' },
  absent:  { chip: '',        dot: '#475569' },
}

function ArrowIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}

export default function KioskPage() {
  const { t } = useLang()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [authOk, setAuthOk] = useState(false)

  const [selected, setSelected] = useState<Employee | null>(null)
  const [punchType, setPunchType] = useState<PunchType>('entrada')
  const [punching, setPunching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [now, setNow] = useState(new Date())
  const recsSeq = useRef(0)

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  const load = useCallback(async () => {
    const seq = ++recsSeq.current
    try {
      const [meRes, empRes, recRes] = await Promise.all([
        fetch('/api/me'),
        fetch('/api/employees'),
        fetch('/api/records?today=true'),
      ])
      if (!meRes.ok) { router.push('/login'); return }
      const me = await meRes.json()
      if (!['admin', 'manager'].includes(me.role)) { router.push('/ponto'); return }
      setAuthOk(true)
      if (empRes.ok) setEmployees(await empRes.json())
      if (recRes.ok) {
        const recs = await recRes.json()
        // Ignore out-of-order responses so a stale reload can't revert a newer state.
        if (seq === recsSeq.current) setTodayRecs(recs)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const i = setInterval(load, 30_000)
    return () => clearInterval(i)
  }, [load])

  const openModal = (emp: Employee) => {
    const recs = todayRecs.filter(r => r.employee_id === emp.id)
    const state = getState(recs)
    const last = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1)
    const defaults: Record<WorkState, PunchType> = {
      absent:  'entrada',
      working: 'saída',
      // A "pause" is either lunch or coffee — resume the same kind based on the LAST
      // punch, not merely whether lunch occurred earlier in the day.
      pause:   last?.type === 'pausa_cafe' ? 'retorno_cafe' : 'fim_almoco',
      out:     'entrada',
    }
    setPunchType(defaults[state])
    setResult(null)
    setSelected(emp)
  }

  const closeModal = () => { setSelected(null); setResult(null) }

  const confirmPunch = async () => {
    if (!selected || punching) return
    setPunching(true)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: punchType, employeeId: selected.id }),
      })
      if (res.ok) {
        // Optimistic update from the inserted record, so the tile state updates
        // immediately even if the follow-up reload is slow, fails, or arrives stale.
        const rec: PunchRecord = await res.json()
        setTodayRecs(prev => [...prev.filter(r => r.id !== rec.id), rec])
        setResult({ ok: true, msg: t('kiosk.success') })
        const seq = ++recsSeq.current
        const updated = await fetch('/api/records?today=true')
        if (updated.ok) {
          const recs = await updated.json()
          if (seq === recsSeq.current) setTodayRecs(recs)
        }
        setTimeout(closeModal, 1400)
      } else {
        const d = await res.json()
        setResult({ ok: false, msg: d.error ?? t('kiosk.error') })
      }
    } catch { setResult({ ok: false, msg: t('kiosk.error') }) }
    finally { setPunching(false) }
  }

  if (!authOk || loading) return (
    <div className="emp-shell">
      <main className="emp-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40, opacity: 0.15, fontFamily: 'var(--font-mono)' }}>…</div>
      </main>
    </div>
  )

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="emp-shell">
      <header className="emp-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.svg" width="26" height="26" alt="" style={{ borderRadius: 6, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('kiosk.title')}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{dateStr}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="emp-clock-time tnum mono" style={{ fontSize: 22, gap: 0 }}>
            <span>{hh}</span><span className="emp-clock-sep">:</span><span>{mm}</span>
            <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 2 }}>:{ss}</span>
          </div>
          <button onClick={() => router.push('/admin')} className="btn ghost sm icon" title="Admin">
            <ArrowIcon size={15}/>
          </button>
        </div>
      </header>

      <main className="emp-main">
        <div className="emp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('kiosk.subtitle')}</div>
          </div>

          {employees.length === 0 ? (
            <div style={{ padding: 20 }}>
              <div className="alert-inline info">{t('kiosk.no_emp')}</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
              gap: 1,
              background: 'var(--border)',
            }}>
              {employees.map(emp => {
                const recs = todayRecs.filter(r => r.employee_id === emp.id)
                const state = getState(recs)
                const { chip, dot } = STATE_STYLE[state]
                const stateKey = state === 'working' ? 'kiosk.working' : state === 'pause' ? 'kiosk.pause' : state === 'out' ? 'kiosk.out' : 'kiosk.absent'
                const dayMin = calcDayMin(recs, emp.lunch_break_minutes)
                return (
                  <button
                    key={emp.id}
                    onClick={() => openModal(emp)}
                    style={{
                      background: 'var(--surface)',
                      border: 'none',
                      padding: '16px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'background 0.12s',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onTouchStart={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onTouchEnd={e => (e.currentTarget.style.background = 'var(--surface)')}
                  >
                    <div style={{ position: 'relative' }}>
                      <div className={`avatar size-56 av-c${empColor(emp.id)}`} style={{ fontSize: 17 }}>{initials(emp.name)}</div>
                      <span style={{
                        position: 'absolute', bottom: 1, right: 1,
                        width: 13, height: 13, borderRadius: '50%',
                        background: dot,
                        border: '2px solid var(--surface)',
                      }}/>
                    </div>
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.3, marginBottom: 4 }}>
                        {emp.name.split(' ')[0]}
                      </div>
                      <span className={`chip ${chip}`} style={{ fontSize: 10, display: 'inline-block' }}>
                        {t(stateKey as Parameters<typeof t>[0])}
                      </span>
                      {dayMin > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                          {fmtMinutes(dayMin)}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Punch modal */}
      {selected && (
        <div
          className="drawer-overlay"
          onClick={closeModal}
          style={{ alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--sidebar-bg)',
              borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
              padding: '24px 20px 48px',
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className={`avatar size-44 av-c${empColor(selected.id)}`} style={{ fontSize: 15 }}>
                {initials(selected.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('kiosk.select_type')}</div>
              </div>
              <button onClick={closeModal} className="btn ghost sm icon">✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
              {PUNCH_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setPunchType(opt.type)}
                  className={`btn ${opt.tone === 'success' ? 'success' : opt.tone === 'danger' ? 'danger' : 'warn'} ${punchType === opt.type ? '' : 'ghost'}`}
                  style={{ justifyContent: 'center', padding: '11px 8px', fontSize: 13, fontWeight: punchType === opt.type ? 700 : 400 }}
                >
                  {t(opt.labelKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>

            {result && (
              <div className={`alert-inline ${result.ok ? 'ok' : 'err'}`} style={{ marginBottom: 14 }}>
                {result.msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeModal} className="btn" style={{ flex: 1, justifyContent: 'center', height: 48 }}>
                {t('kiosk.cancel')}
              </button>
              <button
                onClick={confirmPunch}
                disabled={punching}
                className="btn primary"
                style={{ flex: 2, justifyContent: 'center', height: 48, fontSize: 15 }}
              >
                {punching ? t('kiosk.loading') : t('kiosk.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
