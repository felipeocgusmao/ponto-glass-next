'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, PunchRecord } from '@/lib/types'
import { WORKING_TYPES, calcTimeBreakdown, calcNetMinutes, fmtMinutes, empColor, avatarInitials } from '@/lib/utils'
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

function QrModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/qr?employeeId=${emp.id}`)
      .then(r => r.json())
      .then(d => { setQrUrl(d.qrDataUrl); setLoading(false) })
      .catch(() => setLoading(false))
  }, [emp.id])
  return (
    <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 90 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sidebar-bg)', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 320, margin: 'auto' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{emp.name}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 20 }}>Digitalize para registar ponto com o telemóvel</div>
        {loading && <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>A gerar QR…</div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qrUrl && <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8, display: 'block', margin: '0 auto' }} />}
        <button onClick={onClose} className="btn" style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}>Fechar</button>
      </div>
    </div>
  )
}

interface KioskClientProps {
  initialEmployees: Employee[]
  initialRecords: PunchRecord[]
}

export function KioskClient({ initialEmployees, initialRecords }: KioskClientProps) {
  const { t } = useLang()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>(initialRecords)

  const [selected, setSelected] = useState<Employee | null>(null)
  const [punchType, setPunchType] = useState<PunchType>('entrada')
  const [punching, setPunching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [qrEmp, setQrEmp] = useState<Employee | null>(null)

  // Photo capture
  const [photoEnabled, setPhotoEnabled] = useState(false)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [photoStream, setPhotoStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [now, setNow] = useState(new Date())
  const recsSeq = useRef(0)

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  // Initial employees + records are seeded from the Server Component. This only
  // revalidates on the 30s poll (and after a punch); the auth/role gate now lives
  // in the server page, but we still bounce on a session that expires mid-session.
  const load = useCallback(async () => {
    const seq = ++recsSeq.current
    try {
      const [empRes, recRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/records?today=true'),
      ])
      if (empRes.status === 401 || recRes.status === 401) { router.push('/login'); return }
      if (empRes.ok) setEmployees(await empRes.json())
      if (recRes.ok) {
        const recs = await recRes.json()
        // Ignore out-of-order responses so a stale reload can't revert a newer state.
        if (seq === recsSeq.current) setTodayRecs(recs)
      }
    } catch { /* silent */ }
  }, [router])

  useEffect(() => {
    const i = setInterval(() => { if (document.visibilityState === 'visible') load() }, 30_000)
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

  const stopPhotoStream = () => {
    if (photoStream) { photoStream.getTracks().forEach(t => t.stop()); setPhotoStream(null) }
    setPhotoEnabled(false)
    setPhotoData(null)
  }

  const closeModal = () => { stopPhotoStream(); setSelected(null); setResult(null) }

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' } })
      if (stream) {
        setPhotoStream(stream)
        setPhotoEnabled(true)
        setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 50)
      }
    } catch { /* camera not available */ }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, 320, 240)
    setPhotoData(canvas.toDataURL('image/jpeg', 0.5))
  }

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

        // Upload photo if captured
        if (photoData && rec.id) {
          void fetch('/api/kiosk-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: rec.id, photoData }),
          }).catch(() => {})
        }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="emp-clock-time tnum mono" style={{ fontSize: 22, gap: 0 }}>
            <span>{hh}</span><span className="emp-clock-sep">:</span><span>{mm}</span>
            <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 2 }}>:{ss}</span>
          </div>
          <button onClick={() => router.push('/kiosk/glass')} className="btn ghost sm icon" title="Modo glass (smart glasses)" aria-label="Abrir modo glass para smart glasses" style={{ fontSize: 14 }}>
            🥽
          </button>
          <button onClick={() => router.push('/admin')} className="btn ghost sm icon" title="Admin" aria-label="Ir para o painel de admin">
            <ArrowIcon size={15} aria-hidden />
          </button>
        </div>
      </header>

      <main className="emp-main">
        <div className="emp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)' }}>
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
                      {dayMin > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                          {fmtMinutes(dayMin)}
                        </div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setQrEmp(emp) }}
                        title="Ver QR Code"
                        style={{ marginTop: 6, fontSize: 10, padding: '2px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--fg-muted)' }}
                      >QR</button>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* QR modal */}
      {qrEmp && <QrModal emp={qrEmp} onClose={() => setQrEmp(null)} />}

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

            {/* Photo capture */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: photoEnabled ? 10 : 0 }}>
                <input
                  type="checkbox"
                  checked={photoEnabled}
                  onChange={e => { if (e.target.checked) enableCamera(); else stopPhotoStream() }}
                />
                Tirar foto
              </label>
              {photoEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  {!photoData ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: 160, height: 120, borderRadius: 8, background: 'var(--surface-2)', objectFit: 'cover' }} />
                      <button className="btn ghost sm" onClick={capturePhoto}>Capturar</button>
                    </>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoData} alt="Foto capturada" style={{ width: 160, height: 120, borderRadius: 8, objectFit: 'cover' }} />
                      <button className="btn ghost sm" onClick={() => setPhotoData(null)}>Nova foto</button>
                    </>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
              )}
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
