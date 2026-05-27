'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PunchRecord } from '@/lib/types'
import { businessDate } from '@/lib/utils'

export default function MissingExitBanner() {
  const [alerts, setAlerts] = useState<{ name: string; date: string; reason: string }[]>([])
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    // Build the window [weekAgo, yesterday] from the business-timezone date, anchored at
    // noon UTC so day arithmetic is DST-safe.
    const anchor = new Date(`${businessDate()}T12:00:00Z`)
    const shift = (days: number) => {
      const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + days)
      return d.toISOString().split('T')[0]
    }
    try {
      const res = await fetch(`/api/reports?from=${shift(-7)}&to=${shift(-1)}`)
      if (!res.ok) return
      const records: PunchRecord[] = await res.json()
      const byEmpDate = new Map<string, Map<string, PunchRecord[]>>()
      records.forEach(r => {
        if (!byEmpDate.has(r.employee_id)) byEmpDate.set(r.employee_id, new Map())
        const dm = byEmpDate.get(r.employee_id)!
        if (!dm.has(r.date)) dm.set(r.date, [])
        dm.get(r.date)!.push(r)
      })
      const missing: { name: string; date: string; reason: string }[] = []
      byEmpDate.forEach((dm, empId) => {
        const empName = records.find(r => r.employee_id === empId)?.employee_name ?? empId
        dm.forEach((dayRecs, date) => {
          const ts = (r: PunchRecord) => new Date(r.timestamp).getTime()
          const saidas   = dayRecs.filter(r => r.type === 'saída')
          const entradas = dayRecs.filter(r => r.type === 'entrada')
          const sorted   = [...dayRecs].sort((a, b) => ts(a) - ts(b))
          const lastAny  = sorted.at(-1)
          if (saidas.length === 0) {
            missing.push({ name: empName, date, reason: `sem saída · último: ${lastAny?.type ?? '?'} ${lastAny ? new Date(lastAny.timestamp).toISOString() : ''}` })
            return
          }
          const lastSaida   = saidas.reduce((a, b)  => ts(a) >= ts(b) ? a : b)
          const lastEntrada = entradas.length ? entradas.reduce((a, b) => ts(a) >= ts(b) ? a : b) : null
          if (lastEntrada && ts(lastEntrada) > ts(lastSaida)) {
            missing.push({ name: empName, date, reason: `entrada após saída · entrada: ${new Date(lastEntrada.timestamp).toISOString()} · saída: ${new Date(lastSaida.timestamp).toISOString()}` })
          }
        })
      })
      setAlerts(missing)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    check()
    // Re-check when the admin returns to the window/tab and whenever a record is
    // created/edited/deleted elsewhere in the app, so a manual "saída" clears the
    // alert immediately instead of lingering until a full page reload.
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pg:records-changed', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pg:records-changed', check)
    }
  }, [check])

  if (dismissed || alerts.length === 0) return null

  return (
    <div className="alert-inline warn" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {alerts.length} dia(s) sem saída registrada</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {alerts.map((a) => (
            <div key={`${a.name}-${a.date}`} style={{ fontSize: 12 }}>
              {a.name} — {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
              <span style={{ color: 'var(--fg-dim)', marginLeft: 6 }}>({a.reason})</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="btn ghost sm icon">✕</button>
    </div>
  )
}
