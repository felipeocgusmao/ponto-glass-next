'use client'

import { useState, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { exportCSV, fmtMinutes, calcOvertimePeriod, calcHours, calcNetMinutes, calcTimeBreakdown } from '@/lib/utils'
import { SL, getWorkingDays, openPayslip } from '../../_lib/helpers'

export function RelatoriosTab({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]
  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [filterEmpId, setFilterEmpId] = useState('all')
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (filterEmpId !== 'all') params.set('employeeId', filterEmpId)
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro.'); return }
      const data: PunchRecord[] = await res.json()
      setRecords(data)
      setTruncated(data.length >= 2000)
      setLoaded(true)
    } catch { setError('Erro ao conectar.') }
    finally { setLoading(false) }
  }, [from, to, filterEmpId])

  const byEmp: Record<string, { name: string; records: PunchRecord[] }> = {}
  records.forEach(r => {
    if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { name: r.employee_name, records: [] }
    byEmp[r.employee_id].records.push(r)
  })

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Período</SL>
          <div className="form-grid-2">
            <div className="field"><label>De</label><input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" /></div>
            <div className="field"><label>Até</label><input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" /></div>
          </div>
          <div className="field">
            <label>Funcionário</label>
            <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)} className="input">
              <option value="all">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {error && <div className="alert-inline err">{error}</div>}
          <button onClick={load} disabled={loading} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {loaded && !loading && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            {truncated && (
              <div className="alert-inline warn" style={{ marginBottom: 12 }}>
                Resultado limitado a 2000 registros. Refine o período.
              </div>
            )}
            {records.length === 0
              ? <div className="alert-inline info">Nenhum registro no período.</div>
              : (
                <>
                  <SL>{Object.keys(byEmp).length} pessoa(s) · {records.length} registros</SL>
                  {Object.entries(byEmp).map(([empId, { name, records: recs }]) => {
                    const emp = employees.find(e => e.id === empId)
                    const overtime = calcOvertimePeriod(recs)
                    return (
                      <div key={empId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{recs.length} registros</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{calcHours(recs)}</div>
                          {overtime !== null && (
                            <span className={`chip ${overtime >= 0 ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>
                              {overtime >= 0 ? '+' : ''}{fmtMinutes(Math.abs(overtime))}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => openPayslip(name, `${from} a ${to}`, recs, emp?.workday_hours ?? 8, emp?.lunch_break_minutes ?? 60, emp?.hourly_rate ?? null)}
                          className="btn ghost sm icon" title="Gerar holerite PDF"
                        >📄</button>
                      </div>
                    )
                  })}

                  {(() => {
                    const workingDays = getWorkingDays(from, to)
                    if (workingDays.length < 2) return null
                    const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
                    records.forEach(r => {
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
                    const maxMin = Math.max(...chartData.map(d => d.min), 1)
                    return (
                      <div style={{ marginTop: 20 }}>
                        <SL>Horas por dia</SL>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
                          {chartData.map(({ date, min }) => {
                            const pct = Math.min(100, (min / maxMin) * 100)
                            const d = new Date(date + 'T12:00:00')
                            const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`
                            return (
                              <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                                <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: pct > 0 ? `${pct}%` : 3, background: min === 0 ? 'var(--border)' : 'var(--accent)', opacity: min === 0 ? 1 : 0.5 }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {(() => {
                    const workingDays = getWorkingDays(from, to)
                    if (workingDays.length === 0) return null
                    const targetEmps = filterEmpId === 'all' ? employees : employees.filter(e => e.id === filterEmpId)
                    const presentDates = new Map<string, Set<string>>()
                    records.forEach(r => {
                      if (!presentDates.has(r.employee_id)) presentDates.set(r.employee_id, new Set())
                      presentDates.get(r.employee_id)!.add(r.date)
                    })
                    const absences = targetEmps
                      .map(emp => ({ empName: emp.name, dates: workingDays.filter(d => !presentDates.get(emp.id)?.has(d)) }))
                      .filter(a => a.dates.length > 0)
                    return (
                      <div style={{ marginTop: 20 }}>
                        <SL>Faltas / Ausências</SL>
                        {absences.length === 0
                          ? <div className="alert-inline ok" style={{ fontSize: 12 }}>Sem ausências no período.</div>
                          : absences.map(({ empName, dates }) => (
                            <div key={empName} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 4 }}>
                                {empName} <span style={{ color: 'var(--danger-fg)' }}>({dates.length} falta{dates.length > 1 ? 's' : ''})</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {dates.map(d => {
                                  const dt = new Date(d + 'T12:00:00')
                                  return (
                                    <span key={d} className="chip danger" style={{ fontSize: 10 }}>
                                      {String(dt.getDate()).padStart(2,'0')}/{String(dt.getMonth()+1).padStart(2,'0')}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )
                  })()}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                  <button
                    onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`, employees.map(e => ({ id: e.id, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })))}
                    className="btn primary" style={{ width: '100%', justifyContent: 'center' }}
                  >
                    ⬇ Exportar CSV
                  </button>
                </>
              )
            }
          </div>
        </div>
      )}
    </>
  )
}
