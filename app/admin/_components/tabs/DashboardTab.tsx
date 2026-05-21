'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { fmtMinutes, calcOvertimePeriod, calcNetMinutes, calcTimeBreakdown, WORKING_TYPES } from '@/lib/utils'
import { SL, getWorkingDays } from '../../_lib/helpers'

export function DashboardTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]
  const [monthRecs, setMonthRecs] = useState<PunchRecord[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [bankBalances, setBankBalances] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, tRes] = await Promise.all([
        fetch(`/api/reports?from=${firstOfMonth}&to=${todayStr}`),
        fetch('/api/records?today=true'),
      ])
      if (mRes.ok) setMonthRecs(await mRes.json())
      if (tRes.ok) setTodayRecs(await tRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [firstOfMonth, todayStr])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (employees.length === 0) return
    const fetchAll = async () => {
      const map = new Map<string, number>()
      await Promise.all(employees.map(async emp => {
        try {
          const res = await fetch(`/api/hour-bank?employeeId=${emp.id}`)
          if (res.ok) { const d = await res.json(); map.set(emp.id, d.balanceMin) }
        } catch { /* silent */ }
      }))
      setBankBalances(new Map(map))
    }
    fetchAll()
  }, [employees])

  const todayByEmp = new Map<string, PunchRecord[]>()
  todayRecs.forEach(r => {
    if (!todayByEmp.has(r.employee_id)) todayByEmp.set(r.employee_id, [])
    todayByEmp.get(r.employee_id)!.push(r)
  })

  const onlineNow = employees.filter(emp => {
    const recs = [...(todayByEmp.get(emp.id) ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const last = recs.at(-1)
    return last && WORKING_TYPES.includes(last.type)
  }).length

  const workingDays = getWorkingDays(firstOfMonth, todayStr)
  const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
  monthRecs.forEach(r => {
    if (!byDateEmp.has(r.date)) byDateEmp.set(r.date, new Map())
    const em = byDateEmp.get(r.date)!
    if (!em.has(r.employee_id)) em.set(r.employee_id, [])
    em.get(r.employee_id)!.push(r)
  })

  const chartData = workingDays.map(date => {
    const empMap = byDateEmp.get(date)
    if (!empMap) return { date, min: 0 }
    let totalMin = 0
    empMap.forEach((dayRecs, eId) => {
      const e = employees.find(emp => emp.id === eId)
      const lMin = e?.lunch_break_minutes ?? 60
      const hasBreaks = dayRecs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
      totalMin += hasBreaks ? calcTimeBreakdown(dayRecs).workedMin : Math.max(0, calcNetMinutes(dayRecs, lMin))
    })
    return { date, min: totalMin }
  })
  const maxChartMin = Math.max(...chartData.map(d => d.min), 1)

  const byEmpMonth: Record<string, PunchRecord[]> = {}
  monthRecs.forEach(r => {
    if (!byEmpMonth[r.employee_id]) byEmpMonth[r.employee_id] = []
    byEmpMonth[r.employee_id].push(r)
  })
  const totalMonthMin = Object.values(byEmpMonth).reduce((sum, recs) => sum + Math.max(0, calcOvertimePeriod(recs, 0, 60) ?? 0), 0)

  if (loading) return <div className="card"><div style={{ padding: 20 }}><div className="alert-inline info">Carregando dashboard...</div></div></div>

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="kpi">
            <div className="kpi-label">Online agora</div>
            <div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{onlineNow}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Horas este mês</div>
            <div className="kpi-value">{totalMonthMin > 0 ? fmtMinutes(Math.round(totalMonthMin)) : '—'}</div>
          </div>
        </div>
      </div>

      {workingDays.length >= 2 && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            <SL>Horas por dia — {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</SL>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginTop: 8 }}>
              {chartData.map(({ date, min }) => {
                const pct = Math.min(100, (min / maxChartMin) * 100)
                const d = new Date(date + 'T12:00:00')
                const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
                const isToday = date === todayStr
                return (
                  <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                    <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: pct > 0 ? `${pct}%` : 3, background: min === 0 ? 'var(--border)' : isToday ? 'var(--success-fg)' : 'var(--accent)', opacity: min === 0 ? 1 : 0.5 }} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Funcionários — este mês</SL>
          {employees.map(emp => {
            const empRecs = byEmpMonth[emp.id] ?? []
            const monthMin = empRecs.length > 0 ? Math.max(0, calcOvertimePeriod(empRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
            const targetMin = emp.workday_hours * 60 * workingDays.length
            const pct = targetMin > 0 ? Math.min(100, (monthMin / targetMin) * 100) : 0
            const bank = bankBalances.get(emp.id)
            return (
              <div key={emp.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{emp.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{monthMin > 0 ? fmtMinutes(Math.round(monthMin)) : '—'}</span>
                    {bank !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: bank >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        banco: {bank >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bank))}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', borderRadius: 999, height: 4 }}>
                  <div style={{ height: 4, borderRadius: 999, width: `${pct}%`, background: pct >= 100 ? 'var(--success-fg)' : pct >= 75 ? 'var(--accent)' : 'var(--fg-subtle)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
