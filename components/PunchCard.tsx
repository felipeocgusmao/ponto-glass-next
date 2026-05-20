'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import LiveClock from '@/components/LiveClock'
import { calcNetMinutes, calcTimeBreakdown, fmtMinutes, WORKING_TYPES } from '@/lib/utils'
import type { PunchRecord } from '@/lib/types'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'

const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

const TYPE_SUCCESS: Record<PunchType, string> = {
  entrada:       '✅ Entrada registrada!',
  saída:         '✅ Saída registrada!',
  inicio_almoco: '🍽 Almoço iniciado!',
  fim_almoco:    '✅ Retorno do almoço registrado!',
  pausa_cafe:    '☕ Pausa para café iniciada!',
  retorno_cafe:  '✅ Retorno do café registrado!',
}

const RECORD_LABEL: Record<PunchType, string> = {
  entrada:       'Entrada',
  saída:         'Saída',
  inicio_almoco: 'Almoço',
  fim_almoco:    'Ret. Almoço',
  pausa_cafe:    'Café',
  retorno_cafe:  'Ret. Café',
}

interface Props {
  workdayMinutes?: number
  lunchBreakMinutes?: number
  hourlyRate?: number | null
  userId?: string
  geoMode?: 'required' | 'optional' | 'disabled'
}

function sendNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/icon.png' })
}

export default function PunchCard({
  workdayMinutes = 480,
  lunchBreakMinutes = 60,
  hourlyRate = null,
  userId,
  geoMode = 'optional',
}: Props) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const [bankMin, setBankMin] = useState<number | null>(null)
  const punching = useRef(false)
  const notified = useRef(new Set<string>())
  const notifiedDate = useRef('')

  const load = useCallback(async () => {
    try {
      const url = userId
        ? `/api/records?today=true&employeeId=${userId}`
        : '/api/records?today=true'
      const res = await fetch(url)
      if (res.ok) setRecords(await res.json())
    } catch { /* mantém registros atuais */ }
  }, [userId])

  const loadBank = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/hour-bank?employeeId=${userId}`)
      if (res.ok) { const d = await res.json(); setBankMin(d.balanceMin) }
    } catch { /* silent */ }
  }, [userId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadBank() }, [loadBank])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setLiveMs(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const check = () => {
      const today = new Date().toISOString().split('T')[0]
      if (notifiedDate.current !== today) {
        notified.current.clear()
        notifiedDate.current = today
      }

      const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const lastType = sorted[sorted.length - 1]?.type
      const isWorking = lastType != null && WORKING_TYPES.includes(lastType)
      if (!isWorking) return

      const lastWorkStart = [...sorted].reverse().find(r => WORKING_TYPES.includes(r.type))
      const currentMs = lastWorkStart ? Date.now() - new Date(lastWorkStart.timestamp).getTime() : 0
      const currentMin = currentMs / 60_000

      const hasBreaks = records.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
      const completedMin = hasBreaks
        ? calcTimeBreakdown(records).workedMin
        : calcNetMinutes(records, lunchBreakMinutes)
      const totalNet = completedMin + currentMin

      const remaining = Math.round(workdayMinutes - totalNet)

      if (remaining <= 15 && remaining > 0 && !notified.current.has('warn15')) {
        notified.current.add('warn15')
        sendNotification('⏰ Quase lá!', `Faltam ${remaining} minutos para o fim da jornada.`)
      }

      if (remaining <= 0 && remaining > -2 && !notified.current.has('end')) {
        notified.current.add('end')
        sendNotification('✅ Jornada concluída!', 'Você atingiu sua carga horária. Bom trabalho!')
      }

      if (remaining < 0) {
        const overtimeMin = Math.abs(remaining)
        const step = Math.floor(overtimeMin / 30) * 30
        if (step > 0) {
          const key = `overtime_${step}`
          if (!notified.current.has(key)) {
            notified.current.add(key)
            sendNotification('🕐 Hora extra', `+${fmtMinutes(step)} de hora extra. Lembre-se de registrar a saída!`)
          }
        }
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [records, workdayMinutes, lunchBreakMinutes])

  const captureGeo = (): Promise<{ latitude: number; longitude: number } | null> =>
    new Promise(resolve => {
      if (geoMode === 'disabled' || typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null); return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 30000 },
      )
    })

  const handlePunch = async (type: PunchType) => {
    if (punching.current) return
    punching.current = true
    setLoading(true)
    setMsg(null)

    const geo = await captureGeo()
    if (geoMode === 'required' && !geo) {
      setMsg({ kind: 'error', text: 'Localização necessária. Autorize o acesso e tente novamente.' })
      setLoading(false)
      punching.current = false
      setTimeout(() => setMsg(null), 4_000)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(geo ?? {}) }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      setMsg(res.ok
        ? { kind: 'success', text: TYPE_SUCCESS[type] }
        : { kind: 'error', text: 'Erro ao registrar ponto.' }
      )
      if (res.ok) { await load(); await loadBank() }
    } catch (err) {
      clearTimeout(timeout)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setMsg({ kind: 'error', text: isAbort ? 'Tempo limite excedido. Tente novamente.' : 'Erro ao registrar ponto.' })
    } finally {
      setLoading(false)
      punching.current = false
      setTimeout(() => setMsg(null), 3_000)
    }
  }

  const sortedAsc = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const sorted = [...sortedAsc].reverse()
  const lastType = sorted[0]?.type as PunchType | undefined
  const isWorking = lastType != null && WORKING_TYPES.includes(lastType)
  const isOnLunch = lastType === 'inicio_almoco'
  const isOnCafe  = lastType === 'pausa_cafe'
  const isOut     = !lastType || lastType === 'saída'

  // Live metrics
  const hasBreaks = records.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
  let liveNetMin = 0
  if (hasBreaks) {
    const bd = calcTimeBreakdown(records)
    const lastWorkStart = isWorking
      ? sortedAsc.slice().reverse().find(r => WORKING_TYPES.includes(r.type))
      : undefined
    const ongoingMin = lastWorkStart
      ? (liveMs - new Date(lastWorkStart.timestamp).getTime()) / 60_000
      : 0
    liveNetMin = Math.max(0, bd.workedMin + ongoingMin)
  } else {
    const lastEntry = isWorking
      ? sortedAsc.slice().reverse().find(r => r.type === 'entrada')
      : undefined
    const currentSessionMin = lastEntry
      ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000
      : 0
    liveNetMin = Math.max(0, calcNetMinutes(records, 0) + currentSessionMin - lunchBreakMinutes)
  }

  const liveOvertime  = liveNetMin > 0 ? liveNetMin - workdayMinutes : null
  const liveHours     = liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '—'
  const liveEarnings  = hourlyRate && liveNetMin > 0
    ? ((liveNetMin / 60) * hourlyRate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
    : null

  const metricsCount  = 2 + (liveOvertime !== null ? 1 : 0) + (liveEarnings ? 1 : 0) + (bankMin !== null ? 1 : 0)
  const gridCols      = metricsCount <= 2 ? 'grid-cols-2' : metricsCount === 3 ? 'grid-cols-3' : 'grid-cols-2'

  function statusBadge() {
    if (isWorking)  return <span className="status-in">● Você está dentro</span>
    if (isOnLunch)  return <span className="status-break">🍽 No almoço</span>
    if (isOnCafe)   return <span className="status-break">☕ Pausa café</span>
    return <span className="status-out">● Você está fora</span>
  }

  function recTagClass(type: PunchType) {
    if (type === 'entrada') return 'rec-tag-in'
    if (type === 'saída')   return 'rec-tag-out'
    return 'rec-tag-break'
  }

  return (
    <div className="space-y-4">
      <div className="glass p-8">
        <LiveClock />
        <div className="text-center my-5">
          {statusBadge()}
        </div>
        {msg && (
          <div className={`mb-4 ${msg.kind === 'success' ? 'alert-success' : 'alert-error'}`}>
            {msg.text}
          </div>
        )}

        {isOut && (
          <button onClick={() => handlePunch('entrada')} disabled={loading} className="w-full btn-entrada">
            {loading ? '...' : '▶  Registrar Entrada'}
          </button>
        )}

        {isWorking && (
          <div className="space-y-3">
            <button onClick={() => handlePunch('saída')} disabled={loading} className="w-full btn-saida">
              {loading ? '...' : '⏹  Registrar Saída'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handlePunch('inicio_almoco')} disabled={loading} className="btn-break">
                {loading ? '...' : '🍽  Almoço'}
              </button>
              <button onClick={() => handlePunch('pausa_cafe')} disabled={loading} className="btn-break">
                {loading ? '...' : '☕  Pausa Café'}
              </button>
            </div>
          </div>
        )}

        {isOnLunch && (
          <button onClick={() => handlePunch('fim_almoco')} disabled={loading} className="w-full btn-entrada">
            {loading ? '...' : '↩  Retorno do Almoço'}
          </button>
        )}

        {isOnCafe && (
          <button onClick={() => handlePunch('retorno_cafe')} disabled={loading} className="w-full btn-entrada">
            {loading ? '...' : '↩  Retorno do Café'}
          </button>
        )}
      </div>

      {records.length > 0 && (
        <div className="glass p-6">
          <div className={`grid gap-3 mb-6 ${gridCols}`}>
            <div className="metric-box">
              <div className="metric-val">{liveHours}</div>
              <div className="metric-lbl">Horas hoje</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">{records.length}</div>
              <div className="metric-lbl">Registros</div>
            </div>
            {liveOvertime !== null && (
              <div className="metric-box">
                <div className={`metric-val text-xl ${liveOvertime >= 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                  {liveOvertime >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(liveOvertime))}
                </div>
                <div className="metric-lbl">{liveOvertime >= 0 ? 'Extra' : 'A cumprir'}</div>
              </div>
            )}
            {liveEarnings && (
              <div className="metric-box">
                <div className="metric-val text-green-300 text-lg">{liveEarnings}</div>
                <div className="metric-lbl">Ganhos hoje</div>
              </div>
            )}
            {bankMin !== null && (
              <div className="metric-box">
                <div className={`metric-val text-xl ${bankMin >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                  {bankMin >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bankMin))}
                </div>
                <div className="metric-lbl">Banco horas</div>
              </div>
            )}
          </div>

          {!hasBreaks && lunchBreakMinutes > 0 && (
            <div className="text-white/30 text-xs text-center mb-4">
              Desconto de almoço ({lunchBreakMinutes}min) aplicado automaticamente
            </div>
          )}

          <span className="section-label">Hoje</span>
          {sorted.map((r) => (
            <div key={r.id} className="record-item">
              <span className="font-semibold text-white text-sm">
                {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className={recTagClass(r.type as PunchType)}>
                {RECORD_LABEL[r.type as PunchType] ?? r.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
