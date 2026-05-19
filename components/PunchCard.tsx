'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import LiveClock from '@/components/LiveClock'
import { calcHours, calcOvertimeToday, fmtMinutes } from '@/lib/utils'
import type { PunchRecord } from '@/lib/types'

export default function PunchCard() {
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const punching = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* mantém registros atuais */ }
  }, [])

  useEffect(() => { load() }, [load])

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

  const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const isInside = sorted[0]?.type === 'entrada'
  const overtime = calcOvertimeToday(records)

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
          <div className={`grid gap-3 mb-6 ${overtime !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="metric-box">
              <div className="metric-val">{calcHours(records)}</div>
              <div className="metric-lbl">Horas hoje</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">{records.length}</div>
              <div className="metric-lbl">Registros</div>
            </div>
            {overtime !== null && (
              <div className="metric-box">
                <div className={`metric-val text-xl ${overtime >= 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                  {overtime >= 0 ? '+' : '-'}{fmtMinutes(overtime)}
                </div>
                <div className="metric-lbl">{overtime >= 0 ? 'Extra' : 'A cumprir'}</div>
              </div>
            )}
          </div>

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
