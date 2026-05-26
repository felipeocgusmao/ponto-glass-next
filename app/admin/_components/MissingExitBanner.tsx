'use client'

import { useEffect, useState } from 'react'
import type { PunchRecord } from '@/lib/types'

export default function MissingExitBanner() {
  const [alerts, setAlerts] = useState<{ name: string; date: string }[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      const weekAgo   = new Date(now); weekAgo.setDate(now.getDate() - 7)
      try {
        const res = await fetch(`/api/reports?from=${fmt(weekAgo)}&to=${fmt(yesterday)}`)
        if (!res.ok) return
        const records: PunchRecord[] = await res.json()
        const byEmpDate = new Map<string, Map<string, PunchRecord[]>>()
        records.forEach(r => {
          if (!byEmpDate.has(r.employee_id)) byEmpDate.set(r.employee_id, new Map())
          const dm = byEmpDate.get(r.employee_id)!
          if (!dm.has(r.date)) dm.set(r.date, [])
          dm.get(r.date)!.push(r)
        })
        const missing: { name: string; date: string }[] = []
        byEmpDate.forEach((dm, empId) => {
          const empName = records.find(r => r.employee_id === empId)?.employee_name ?? empId
          dm.forEach((dayRecs, date) => {
            const last = [...dayRecs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1)
            // Any day whose final punch isn't a "saída" is a missing exit — including days the
            // employee forgot to clock out after starting lunch or a coffee break.
            if (last && last.type !== 'saída') missing.push({ name: empName, date })
          })
        })
        setAlerts(missing)
      } catch { /* silent */ }
    }
    check()
  }, [])

  if (dismissed || alerts.length === 0) return null

  return (
    <div className="alert-inline warn" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {alerts.length} dia(s) sem saída registrada</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {alerts.map((a) => (
            <div key={`${a.name}-${a.date}`} style={{ fontSize: 12 }}>
              {a.name} — {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="btn ghost sm icon">✕</button>
    </div>
  )
}
