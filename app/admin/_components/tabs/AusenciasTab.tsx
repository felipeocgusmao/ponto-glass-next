'use client'

import { useState, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'
import type { Employee } from '@/lib/types'

interface AusenciaRow {
  employee_id: string
  employee_name: string
  absences: number
  late_count: number
  total_late_min: number
}

interface Props {
  employees: Employee[]
}

function pad(n: number) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function monthStartStr() {
  const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`
}

export function AusenciasTab({ employees }: Props) {
  const { t } = useLang()
  const [from, setFrom] = useState(monthStartStr)
  const [to, setTo] = useState(todayStr)
  const [empId, setEmpId] = useState('')
  const [rows, setRows] = useState<AusenciaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const analyse = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, mode: 'absence' })
      if (empId) params.set('employeeId', empId)
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) return
      const json = await res.json()
      const recs: { employee_id: string; employee_name: string; date: string; type: string; timestamp: string }[] = json.data ?? []

      // Group by employee → date
      const byEmp = new Map<string, { name: string; byDate: Map<string, { types: string[]; timestamps: string[] }> }>()
      for (const r of recs) {
        if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, { name: r.employee_name, byDate: new Map() })
        const emp = byEmp.get(r.employee_id)!
        if (!emp.byDate.has(r.date)) emp.byDate.set(r.date, { types: [], timestamps: [] })
        emp.byDate.get(r.date)!.types.push(r.type)
        emp.byDate.get(r.date)!.timestamps.push(r.timestamp)
      }

      // Build working dates set (Mon–Fri in range, excluding exceptions)
      const excRes = await fetch(`/api/day-exceptions?from=${from}&to=${to}`)
      const exceptions: { date: string; employee_id: string | null }[] = excRes.ok ? await excRes.json() : []
      const companyHolidays = new Set(exceptions.filter(e => !e.employee_id).map(e => e.date))
      const empHolidays = new Map<string, Set<string>>()
      for (const e of exceptions.filter(x => x.employee_id)) {
        const s = empHolidays.get(e.employee_id!) ?? new Set()
        s.add(e.date)
        empHolidays.set(e.employee_id!, s)
      }

      const workDays: string[] = []
      const cur = new Date(from + 'T12:00:00Z')
      const end = new Date(to + 'T12:00:00Z')
      while (cur <= end) {
        const dow = cur.getUTCDay()
        if (dow !== 0 && dow !== 6) {
          const d = cur.toISOString().slice(0, 10)
          if (!companyHolidays.has(d)) workDays.push(d)
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }

      const result: AusenciaRow[] = []
      const targetEmps = empId
        ? employees.filter(e => e.id === empId)
        : employees.filter(e => e.active !== false && e.role === 'employee')

      for (const emp of targetEmps) {
        const empData = byEmp.get(emp.id)
        const name = empData?.name ?? emp.name
        let absences = 0
        let late_count = 0
        let total_late_min = 0

        for (const day of workDays) {
          if (empHolidays.get(emp.id)?.has(day)) continue
          const dayData = empData?.byDate.get(day)
          if (!dayData) { absences++; continue }

          const entryTs = dayData.timestamps.find((_, i) => dayData.types[i] === 'entrada')
          if (!entryTs) { absences++; continue }

          // Lateness: compare to expected_start if set
          const profile = employees.find(e => e.id === emp.id) as any
          const expectedStart = profile?.expected_start
          if (expectedStart) {
            const [eh, em] = expectedStart.split(':').map(Number)
            const entry = new Date(entryTs)
            const entryMin = entry.getHours() * 60 + entry.getMinutes()
            const expectedMin = eh * 60 + em
            const diff = entryMin - expectedMin
            if (diff > 5) { late_count++; total_late_min += diff }
          }
        }

        if (absences > 0 || late_count > 0) {
          result.push({ employee_id: emp.id, employee_name: name, absences, late_count, total_late_min })
        }
      }

      result.sort((a, b) => (b.absences + b.late_count) - (a.absences + a.late_count))
      setRows(result)
      setLoaded(true)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [from, to, empId, employees])

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.ausencias')}</div>
          <div className="page-sub">{t('aus.subtitle')}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>{t('aus.from')}</div>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 140 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>{t('aus.to')}</div>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} style={{ width: 140 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>{t('aus.employee')}</div>
            <select className="input" value={empId} onChange={e => setEmpId(e.target.value)} style={{ width: 180 }}>
              <option value="">{t('aus.all')}</option>
              {employees.filter(e => e.active !== false && e.role === 'employee').map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <button className="btn primary" onClick={analyse} disabled={loading || !from || !to}>
            {loading ? t('aus.generating') : t('aus.generate')}
          </button>
        </div>
      </div>

      {loaded && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            {rows.length === 0 ? (
              <div className="alert-inline ok">{t('aus.no_data')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('aus.col.emp')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('aus.col.absences')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('aus.col.late')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('aus.col.min_late')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 500 }}>{row.employee_name}</td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        {row.absences > 0
                          ? <span className="chip danger" style={{ fontSize: 11 }}>{row.absences}</span>
                          : <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        {row.late_count > 0
                          ? <span className="chip warn" style={{ fontSize: 11 }}>{row.late_count}</span>
                          : <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {row.total_late_min > 0 ? row.total_late_min : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  )
}
