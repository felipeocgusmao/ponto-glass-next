'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { WORKING_TYPES, empColor, avatarInitials } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'

// Kiosk for the shared tablet that is NEVER logged in: authenticated by the
// tenant's kiosk_token (from /kiosk?token=...), reading the roster via
// /api/kiosk/employees and punching via /api/kiosk/punch. The session-based
// KioskClient stays as-is for admins already signed in on their own device.

type WorkState = 'working' | 'pause' | 'out' | 'absent'
type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'

interface KioskEmployee {
  id: string
  name: string
  last_type: string | null
}

function stateFromLastType(lastType: string | null): WorkState {
  if (!lastType) return 'absent'
  if (WORKING_TYPES.includes(lastType)) return 'working'
  if (lastType === 'inicio_almoco' || lastType === 'pausa_cafe') return 'pause'
  if (lastType === 'saída') return 'out'
  return 'absent'
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

export function TokenKioskClient({ token }: { token: string }) {
  const { t } = useLang()
  const [employees, setEmployees] = useState<KioskEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [selected, setSelected] = useState<KioskEmployee | null>(null)
  const [punchType, setPunchType] = useState<PunchType>('entrada')
  const [punching, setPunching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [now, setNow] = useState(new Date())
  const loadSeq = useRef(0)

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const res = await fetch(`/api/kiosk/employees?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      if (!res.ok) { setLoadError(true); return }
      const data: KioskEmployee[] = await res.json()
      // Ignore out-of-order responses so a stale reload can't revert a newer state.
      if (seq === loadSeq.current) { setEmployees(data); setLoadError(false) }
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const i = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => clearInterval(i)
  }, [load])

  const openModal = (emp: KioskEmployee) => {
    const state = stateFromLastType(emp.last_type)
    const defaults: Record<WorkState, PunchType> = {
      absent:  'entrada',
      working: 'saída',
      // A "pause" is either lunch or coffee — resume the same kind based on
      // the last punch, mirroring the session kiosk.
      pause:   emp.last_type === 'pausa_cafe' ? 'retorno_cafe' : 'fim_almoco',
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
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, employee_id: selected.id, type: punchType }),
      })
      if (res.ok) {
        // Optimistic tile update; the follow-up reload reconciles with the server.
        setEmployees(prev => prev.map(e => e.id === selected.id ? { ...e, last_type: punchType } : e))
        setResult({ ok: true, msg: t('kiosk.success') })
        void load()
        setTimeout(closeModal, 1400)
      } else {
        const d = await res.json().catch(() => ({}))
        setResult({ ok: false, msg: d.error ?? t('kiosk.error') })
      }
    } catch { setResult({ ok: false, msg: t('kiosk.error') }) }
    finally { setPunching(false) }
  }

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="emp-shell">
      <header className="emp-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.svg" width="26" height="26" alt="" style={{ borderRadius: 6, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('kiosk.title')}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{dateStr}</div>
          </div>
        </div>
        <div className="emp-clock-time tnum mono" style={{ fontSize: 22, gap: 0 }}>
          <span>{hh}</span><span className="emp-clock-sep">:</span><span>{mm}</span>
          <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 2 }}>:{ss}</span>
        </div>
      </header>

      <main className="emp-main">
        <div className="emp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('kiosk.subtitle')}</div>
          </div>

          {loading ? (
            <div style={{ padding: 20, color: 'var(--fg-muted)', fontSize: 13 }}>{t('common.loading')}</div>
          ) : loadError ? (
            <div style={{ padding: 20 }}>
              <div className="alert-inline err">{t('kiosk.error')}</div>
            </div>
          ) : employees.length === 0 ? (
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
                const state = stateFromLastType(emp.last_type)
                const { chip, dot } = STATE_STYLE[state]
                const stateKey = state === 'working' ? 'kiosk.working' : state === 'pause' ? 'kiosk.pause' : state === 'out' ? 'kiosk.out' : 'kiosk.absent'
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
                      <div className={`avatar size-56 av-c${empColor(emp.id)}`} style={{ fontSize: 17 }}>{avatarInitials(emp.name)}</div>
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
                {avatarInitials(selected.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('kiosk.select_type')}</div>
              </div>
              <button onClick={closeModal} className="btn ghost sm icon" aria-label="Fechar">✕</button>
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
