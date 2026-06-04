'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, PunchRecord } from '@/lib/types'
import { WORKING_TYPES } from '@/lib/utils'
import { getSpeechRecognition, isSpeechSynthesisAvailable, parseVoiceCommand, speak } from '@/lib/voice'

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

function nextPunch(recs: PunchRecord[]): PunchType {
  const state = getState(recs)
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted.at(-1)
  if (state === 'working') return 'saída'
  if (state === 'pause') return last?.type === 'pausa_cafe' ? 'retorno_cafe' : 'fim_almoco'
  return 'entrada'
}

const LABELS: Record<PunchType, string> = {
  entrada: 'ENTRADA',
  'saída': 'SAÍDA',
  inicio_almoco: 'ALMOÇO',
  fim_almoco: 'VOLTA',
  pausa_cafe: 'PAUSA',
  retorno_cafe: 'VOLTA',
}

const STATE_LABEL: Record<WorkState, string> = {
  working: 'AO TRABALHO',
  pause:   'EM PAUSA',
  out:     'SAIU',
  absent:  'AUSENTE',
}

const STATE_COLOR: Record<WorkState, string> = {
  working: '#fbbf24',  // amber
  pause:   '#f59e0b',
  out:     '#94a3b8',
  absent:  '#475569',
}

const COUNTDOWN_MS = 3000

export default function KioskGlassPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [authOk, setAuthOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [pendingEmp, setPendingEmp] = useState<Employee | null>(null)
  const [countdownPct, setCountdownPct] = useState(100)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const recsSeq = useRef(0)
  const countdownRaf = useRef<number | null>(null)
  const punchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Voice command (Web Speech API) — typed by hand because lib.dom omits SpeechRecognition.
  type RecognitionInstance = {
    start(): void; stop(): void; abort(): void
    lang: string; continuous: boolean; interimResults: boolean
    onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
  }
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  // Stable refs so the recognition callback always sees the latest state without re-binding the listener.
  const employeesRef = useRef<Employee[]>([])
  const todayRecsRef = useRef<PunchRecord[]>([])
  const pendingEmpRef = useRef<Employee | null>(null)
  const selectedIdxRef = useRef(0)
  useEffect(() => { employeesRef.current = employees }, [employees])
  useEffect(() => { todayRecsRef.current = todayRecs }, [todayRecs])
  useEffect(() => { pendingEmpRef.current = pendingEmp }, [pendingEmp])
  useEffect(() => { selectedIdxRef.current = selectedIdx }, [selectedIdx])

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
      if (recRes.ok && seq === recsSeq.current) setTodayRecs(await recRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const i = setInterval(load, 30_000)
    return () => clearInterval(i)
  }, [load])

  // Voice command setup — runs once on mount. Speech Recognition is non-standard
  // (Chrome/Edge/Safari iOS 14.5+; not Firefox). Falls back silently to D-pad-only
  // operation when unsupported. Listening is push-to-talk (button or 'M' key).
  useEffect(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    setVoiceSupported(true)
    const rec = new Ctor()
    rec.lang = 'pt-PT'
    rec.continuous = false
    rec.interimResults = false

    rec.onresult = (e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      const last = e.results[e.results.length - 1]
      if (!last?.isFinal) return
      const transcript = last[0]?.transcript ?? ''
      setVoiceTranscript(transcript)
      setVoiceState('processing')
      handleTranscript(transcript)
    }
    rec.onerror = () => { setVoiceState('idle') }
    rec.onend = () => {
      // Drop back to idle only if we weren't still handing off to the punch flow.
      setVoiceState(prev => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = rec
    return () => { try { rec.abort() } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (voiceState === 'listening') { try { rec.stop() } catch { /* ignore */ } ; setVoiceState('idle'); return }
    setVoiceTranscript('')
    setVoiceState('listening')
    try { rec.start() } catch { setVoiceState('idle') }
  }, [voiceState])

  const handleTranscript = useCallback((text: string) => {
    const cmd = parseVoiceCommand(text, employeesRef.current.map(e => ({ id: e.id, name: e.name })))
    if (cmd.kind === 'cancel') {
      if (pendingEmpRef.current) { cancelPunch(); speak('Cancelado.') }
      setVoiceState('idle')
      return
    }
    if (cmd.kind === 'select') {
      const idx = employeesRef.current.findIndex(e => e.id === cmd.employeeId)
      if (idx >= 0) {
        setSelectedIdx(idx)
        const emp = employeesRef.current[idx]
        speak(`${emp.name.split(' ')[0]} selecionado.`)
      }
      setVoiceState('idle')
      return
    }
    if (cmd.kind === 'punch') {
      const emp = employeesRef.current[selectedIdxRef.current]
      if (emp) startPunch(emp, { source: 'voice', overrideType: cmd.type })
      setVoiceState('idle')
      return
    }
    if (cmd.kind === 'select-and-punch') {
      const idx = employeesRef.current.findIndex(e => e.id === cmd.employeeId)
      if (idx >= 0) {
        setSelectedIdx(idx)
        startPunch(employeesRef.current[idx], { source: 'voice', overrideType: cmd.type })
      }
      setVoiceState('idle')
      return
    }
    // Unknown — let the user know we heard but didn't understand.
    speak('Não entendi o comando.')
    setVoiceState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard / D-pad navigation (smart-glasses touchpad maps to arrow keys + enter).
  // 'M' (or 'V') toggles voice listening when supported.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M' || e.key === 'v' || e.key === 'V') && voiceSupported && !pendingEmp) {
        e.preventDefault()
        toggleListening()
        return
      }
      if (pendingEmp) {
        if (e.key === 'Escape' || e.key === 'Backspace') cancelPunch()
        return
      }
      if (employees.length === 0) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setSelectedIdx(i => (i + 1) % employees.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setSelectedIdx(i => (i - 1 + employees.length) % employees.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const emp = employees[selectedIdx]
        if (emp) startPunch(emp)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, selectedIdx, pendingEmp, voiceSupported, toggleListening])

  const cancelPunch = () => {
    if (countdownRaf.current) cancelAnimationFrame(countdownRaf.current)
    if (punchTimer.current) clearTimeout(punchTimer.current)
    countdownRaf.current = null
    punchTimer.current = null
    setPendingEmp(null)
    setCountdownPct(100)
  }

  const startPunch = (emp: Employee, opts: { source?: 'voice' | 'tap'; overrideType?: PunchType } = {}) => {
    cancelPunch()
    setResult(null)
    setPendingEmp(emp)
    const start = performance.now()
    const tick = () => {
      const elapsed = performance.now() - start
      const pct = Math.max(0, 100 - (elapsed / COUNTDOWN_MS) * 100)
      setCountdownPct(pct)
      if (pct > 0) countdownRaf.current = requestAnimationFrame(tick)
    }
    countdownRaf.current = requestAnimationFrame(tick)
    punchTimer.current = setTimeout(() => doPunch(emp, opts.overrideType), COUNTDOWN_MS)
  }

  const doPunch = async (emp: Employee, overrideType?: PunchType) => {
    const recs = todayRecsRef.current.filter(r => r.employee_id === emp.id)
    const type = overrideType ?? nextPunch(recs)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, employeeId: emp.id }),
      })
      if (res.ok) {
        const rec: PunchRecord = await res.json()
        setTodayRecs(prev => [...prev.filter(r => r.id !== rec.id), rec])
        const firstName = emp.name.split(' ')[0]
        setResult({ ok: true, msg: `${firstName}: ${LABELS[type]}` })
        // Spoken confirmation — helpful when the glass user can't easily read the screen.
        speak(`${LABELS[type].toLowerCase()} registada para ${firstName}.`)
      } else {
        const d = await res.json()
        setResult({ ok: false, msg: d.error ?? 'ERRO' })
        speak('Erro ao registar ponto.')
      }
    } catch {
      setResult({ ok: false, msg: 'SEM REDE' })
      speak('Sem ligação.')
    }
    finally {
      setPendingEmp(null)
      setCountdownPct(100)
      setTimeout(() => setResult(null), 2500)
    }
  }

  if (!authOk || loading) return (
    <div style={shellStyle}>
      <div style={{ color: '#fbbf24', fontSize: 32, fontWeight: 700 }}>…</div>
    </div>
  )

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ color: '#fbbf24', fontSize: 14, fontWeight: 800, letterSpacing: '0.18em' }}>PONTOGLASS</span>
          <span style={{ color: '#94a3b8', fontSize: 11, letterSpacing: '0.1em' }}>GLASS MODE</span>
        </div>
        <div style={{ color: '#fbbf24', fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em' }}>
          {hh}:{mm}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {voiceSupported && (
            <button
              onClick={toggleListening}
              style={{
                ...exitBtnStyle,
                background: voiceState === 'listening' ? '#fbbf24' : 'transparent',
                color: voiceState === 'listening' ? '#000' : '#fbbf24',
                borderColor: voiceState === 'listening' ? '#fbbf24' : '#fbbf24',
                fontSize: 18, lineHeight: 1,
              }}
              aria-label={voiceState === 'listening' ? 'Parar escuta de voz' : 'Ativar comando de voz'}
              title="Comando de voz (M)"
            >
              {voiceState === 'listening' ? '●' : '🎙'}
            </button>
          )}
          <button onClick={() => router.push('/kiosk')} style={exitBtnStyle} aria-label="Voltar ao kiosk normal">
            ✕
          </button>
        </div>
      </header>

      {result && (
        <div style={{
          ...overlayStyle,
          background: result.ok ? '#16a34a' : '#dc2626',
        }}>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.02em' }}>
            {result.ok ? '✓' : '✗'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 12, textAlign: 'center', padding: '0 24px' }}>
            {result.msg}
          </div>
        </div>
      )}

      {pendingEmp && !result && (
        <div style={overlayStyle}>
          <div style={{ fontSize: 20, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
            A BATER
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', textAlign: 'center', padding: '0 24px' }}>
            {pendingEmp.name.split(' ')[0].toUpperCase()}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', marginTop: 6 }}>
            {LABELS[nextPunch(todayRecs.filter(r => r.employee_id === pendingEmp.id))]}
          </div>
          <div style={countdownTrackStyle}>
            <div style={{ ...countdownBarStyle, width: `${countdownPct}%` }} />
          </div>
          <button onClick={cancelPunch} style={cancelBtnStyle}>
            CANCELAR (ESC)
          </button>
        </div>
      )}

      {!pendingEmp && !result && (
        employees.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: 22, fontWeight: 700 }}>
            SEM FUNCIONÁRIOS
          </div>
        ) : (
          <div style={gridStyle}>
            {employees.map((emp, i) => {
              const recs = todayRecs.filter(r => r.employee_id === emp.id)
              const state = getState(recs)
              const next = nextPunch(recs)
              const isSelected = i === selectedIdx
              return (
                <button
                  key={emp.id}
                  onClick={() => startPunch(emp)}
                  style={{
                    ...tileStyle,
                    borderColor: isSelected ? '#fbbf24' : '#1e293b',
                    background: isSelected ? '#1e293b' : '#0f172a',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {emp.name.split(' ')[0].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: STATE_COLOR[state],
                      boxShadow: state === 'working' ? '0 0 8px #fbbf24' : 'none',
                    }}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>
                      {STATE_LABEL[state]}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 'auto',
                    background: '#fbbf24', color: '#000',
                    fontSize: 16, fontWeight: 900, padding: '6px 10px',
                    borderRadius: 4, textAlign: 'center', letterSpacing: '0.04em',
                  }}>
                    {LABELS[next]}
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}

      <footer style={footerStyle}>
        {voiceState === 'listening' && (
          <span style={{ color: '#000', background: '#fbbf24', padding: '2px 8px', borderRadius: 3, marginRight: 10 }}>
            ● A ESCUTAR…
          </span>
        )}
        {voiceState !== 'listening' && voiceTranscript && (
          <span style={{ color: '#94a3b8', marginRight: 10, textTransform: 'none' }}>
            ouvi: &ldquo;{voiceTranscript}&rdquo;
          </span>
        )}
        ← → SELECIONAR · ENTER PARA BATER · ESC PARA CANCELAR{voiceSupported ? ' · M PARA VOZ' : ''}
      </footer>
    </div>
  )
}

const shellStyle: React.CSSProperties = {
  width: '100vw', height: '100vh',
  background: '#000', color: '#fff',
  display: 'flex', flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#000', borderBottom: '2px solid #fbbf24',
  height: 44, flexShrink: 0,
}

const exitBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #475569',
  color: '#94a3b8', fontSize: 14, fontWeight: 700,
  width: 32, height: 32, borderRadius: 4, cursor: 'pointer',
}

const gridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 6, padding: 8,
  overflow: 'auto',
}

const tileStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  minHeight: 110,
  padding: '10px 12px',
  border: '2px solid #1e293b',
  borderRadius: 6,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
  textAlign: 'left',
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', top: 44, left: 0, right: 0, bottom: 28,
  background: '#000',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  zIndex: 10,
}

const countdownTrackStyle: React.CSSProperties = {
  width: '60%', height: 12,
  background: '#1e293b', borderRadius: 6,
  marginTop: 16,
  overflow: 'hidden',
}

const countdownBarStyle: React.CSSProperties = {
  height: '100%',
  background: '#fbbf24',
  transition: 'width 50ms linear',
}

const cancelBtnStyle: React.CSSProperties = {
  marginTop: 14, padding: '8px 24px',
  background: 'transparent', border: '2px solid #fff',
  color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: '0.04em',
  borderRadius: 4, cursor: 'pointer',
}

const footerStyle: React.CSSProperties = {
  height: 28, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#000', borderTop: '1px solid #1e293b',
  color: '#fbbf24', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
}
