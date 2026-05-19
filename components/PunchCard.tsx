'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import LiveClock from '@/components/LiveClock'
import { calcNetMinutes, fmtMinutes } from '@/lib/utils'
import type { PunchRecord } from '@/lib/types'

interface Props {
  workdayMinutes?: number
  lunchBreakMinutes?: number
  hourlyRate?: number | null
}

function sendNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/icon.png' })
}

export default function PunchCard({
  workdayMinutes = 480,
  lunchBreakMinutes = 60,
  hourlyRate = null,
}: Props) {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const punching = useRef(false)
  const notified = useRef(new Set<string>())
  const notifiedDate = useRef('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* mantém registros atuais */ }
  }, [])

  useEffect(() => { load() }, [load])

  // Request notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Live metrics tick — update every 30s
  useEffect(() => {
    const interval = setInterval(() => setLiveMs(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Notification checker — runs every minute
  useEffect(() => {
    const check = () => {
      const today = new Date().toISOString().split('T')[0]
      if (notifiedDate.current !== today) {
        notified.current.clear()
        notifiedDate.current = today
      }

      const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const isInside = sorted[sorted.length - 1]?.type === 'entrada'
      if (!isInside) return // só notifica quando dentro

      // Inclui sessão atual no cálculo
      const lastEntry = [...sorted].reverse().find(r => r.type === 'entrada')
      const currentMs = lastEntry ? Date.now() - new Date(lastEntry.timestamp).getTime() : 0
      const currentMin = currentMs / 60_000

      const completedMin = calcNetMinutes(records, lunchBreakMinutes)
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

  const handlePunch = async (type: 'entrada' | 'saída') => {
    if (punching.current) return
    punching.current = true
    setLoading(true)
    setMsg(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      setMsg(res.ok
        ? { kind: 'success', text: type === 'entrada' ? '✅ Entrada registrada!' : '✅ Saída registrada!' }
        : { kind: 'error', text: 'Erro ao registrar ponto.' }
      )
      if (res.ok) await load()
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
  const isInside = sorted[0]?.type === 'entrada'

  // Live metrics — includes current ongoing session, updated every 30s via liveMs
  const lastEntry = isInside ? sortedAsc.slice().reverse().find(r => r.type === 'entrada') : undefined
  const currentSessionMin = isInside && lastEntry
    ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000
    : 0
  const rawPairedMin = calcNetMinutes(records, 0)
  const liveRawMin = rawPairedMin + currentSessionMin
  const liveNetMin = Math.max(0, liveRawMin - lunchBreakMinutes)
  const liveOvertime = liveRawMin > 0 ? liveNetMin - workdayMinutes : null
  const liveHours = liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '—'
  const liveEarnings = hourlyRate && liveNetMin > 0
    ? ((liveNetMin / 60) * hourlyRate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
    : null

  return (
    <div className="space-y-4">
      <div className="glass p-8">
        <LiveClock />
        <div className="text-center my-5">
          <span className={isInside ? 'status-in' : 'status-out'}>
            {isInside ? '● Você está dentro' : '● Você está fora'}
          </span>
        </div>
        {msg && (
          <div className={`mb-4 ${msg.kind === 'success' ? 'alert-success' : 'alert-error'}`}>
            {msg.text}
          </div>
        )}
        <button
          onClick={() => handlePunch(isInside ? 'saída' : 'entrada')}
          disabled={loading}
          className={`w-full ${isInside ? 'btn-saida' : 'btn-entrada'}`}
        >
          {loading ? '...' : isInside ? '⏹  Registrar Saída' : '▶  Registrar Entrada'}
        </button>
      </div>

      {records.length > 0 && (
        <div className="glass p-6">
          <div className={`grid gap-3 mb-6 ${liveOvertime !== null ? (liveEarnings ? 'grid-cols-4' : 'grid-cols-3') : (liveEarnings ? 'grid-cols-3' : 'grid-cols-2')}`}>
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
                  {liveOvertime >= 0 ? '+' : '-'}{fmtMinutes(liveOvertime)}
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
          </div>

          {lunchBreakMinutes > 0 && (
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
              <span className={r.type === 'entrada' ? 'rec-tag-in' : 'rec-tag-out'}>
                {r.type === 'entrada' ? 'Entrada' : 'Saída'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
