'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, PunchRecord } from '@/lib/types'
import { WORKING_TYPES } from '@/lib/utils'
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

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function empColor(id: string): number {
  return (id.charCodeAt(0) % 8) + 1
}

const PUNCH_OPTIONS: { type: PunchType; labelKey: string; tone: string }[] = [
  { type: 'entrada',       labelKey: 'punch.entrada',       tone: 'success' },
  { type: 'saída',         labelKey: 'punch.saída',         tone: 'danger' },
  { type: 'inicio_almoco', labelKey: 'punch.inicio_almoco', tone: 'warn' },
  { type: 'fim_almoco',    labelKey: 'punch.fim_almoco',    tone: 'success' },
  { type: 'pausa_cafe',    labelKey: 'punch.pausa_cafe',    tone: 'warn' },
  { type: 'retorno_cafe',  labelKey: 'punch.retorno_cafe',  tone: 'success' },
]

const STATE_DOT: Record<WorkState, string> = {
  working: '#22c55e',
  pause:   '#eab308',
  out:     '#94a3b8',
  absent:  '#ef4444',
}

export default function KioskPage() {
  const { t } = useLang()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [authOk, setAuthOk] = useState(false)

  // modal state
  const [selected, setSelected] = useState<Employee | null>(null)
  const [punchType, setPunchType] = useState<PunchType>('entrada')
  const [punching, setPunching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  const load = useCallback(async () => {
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
      if (recRes.ok) setTodayRecs(await recRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  // auto-refresh every 30s
  useEffect(() => {
    const i = setInterval(load, 30_000)
    return () => clearInterval(i)
  }, [load])

  const openModal = (emp: Employee) => {
    const recs = todayRecs.filter(r => r.employee_id === emp.id)
    const state = getState(recs)
    // suggest next logical punch type
    const defaults: Record<WorkState, PunchType> = {
      absent:  'entrada',
      working: 'saída',
      pause:   recs.some(r => r.type === 'inicio_almoco') ? 'fim_almoco' : 'retorno_cafe',
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
        setResult({ ok: true, msg: t('kiosk.success') })
        const updated = await fetch('/api/records?today=true')
        if (updated.ok) setTodayRecs(await updated.json())
        setTimeout(closeModal, 1400)
      } else {
        const d = await res.json()
        setResult({ ok: false, msg: d.error ?? t('kiosk.error') })
      }
    } catch { setResult({ ok: false, msg: t('kiosk.error') }) }
    finally { setPunching(false) }
  }

  if (!authOk || loading) return (
    <div style={{ height: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--fg)' }}>
      <div style={{ fontSize: 32, opacity: 0.2, fontFamily: 'var(--font-mono)' }}>…</div>
    </div>
  )

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--fg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--sidebar-bg)',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('kiosk.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>{t('kiosk.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', color: 'var(--fg)' }}>
            {hh}:{mm}
          </div>
          <button onClick={() => router.push('/admin')} className="btn ghost sm" style={{ fontSize: 12 }}>
            ← Admin
          </button>
        </div>
      </header>

      {/* Employee grid */}
      <main style={{ flex: 1, padding: '24px 20px', overflowY: 'auto' }}>
        {employees.length === 0 ? (
          <div className="alert-inline info">{t('kiosk.no_emp')}</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
          }}>
            {employees.map(emp => {
              const recs = todayRecs.filter(r => r.employee_id === emp.id)
              const state = getState(recs)
              const stateLabel = t(('kiosk.' + (state === 'working' ? 'working' : state === 'pause' ? 'pause' : state === 'out' ? 'out' : 'absent')) as Parameters<typeof t>[0])
              return (
                <button
                  key={emp.id}
                  onClick={() => openModal(emp)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--r-lg)',
                    padding: '20px 16px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s, transform 0.1s',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                  onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                  onTouchEnd={e => (e.currentTarget.style.transform = '')}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                  onMouseUp={e => (e.currentTarget.style.transform = '')}
                >
                  <div style={{ position: 'relative' }}>
                    <div className={`avatar size-56 av-c${empColor(emp.id)}`} style={{ fontSize: 18 }}>{initials(emp.name)}</div>
                    <span style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 14, height: 14, borderRadius: '50%',
                      background: STATE_DOT[state],
                      border: '2px solid var(--surface-2)',
                    }}/>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.3 }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>{stateLabel}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
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
              padding: '24px 24px 40px',
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            {/* Employee header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className={`avatar size-44 av-c${empColor(selected.id)}`} style={{ fontSize: 15 }}>{initials(selected.name)}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('kiosk.select_type')}</div>
              </div>
              <button onClick={closeModal} className="btn ghost sm icon" style={{ marginLeft: 'auto' }}>✕</button>
            </div>

            {/* Punch type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              {PUNCH_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setPunchType(opt.type)}
                  className={`btn ${opt.tone === 'success' ? 'success' : opt.tone === 'danger' ? 'danger' : 'warn'} ${punchType === opt.type ? '' : 'ghost'}`}
                  style={{ justifyContent: 'center', padding: '12px 8px', fontSize: 13, fontWeight: punchType === opt.type ? 700 : 400 }}
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
