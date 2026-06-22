'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { exportCSV, exportPDF, fmtCentesimal, fmtCentesimalSigned, fmtEur, roundToQuarter, calcOvertimePeriod, calcWorkedMinutesPeriod, calcNetMinutes, businessDate, isIncompleteDay, avatarInitials } from '@/lib/utils'
import { empColor, getWorkingDays, openPayslip } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconDownload, IconRefresh } from '../icons'

type RangePreset = 'this_month' | 'last_month' | '30d' | 'quarter' | 'custom'

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function presetRange(p: RangePreset, today: string): { from: string; to: string } | null {
  const t = new Date(today + 'T12:00:00')
  if (p === 'this_month') {
    const first = new Date(t.getFullYear(), t.getMonth(), 1)
    return { from: ymd(first), to: today }
  }
  if (p === 'last_month') {
    const first = new Date(t.getFullYear(), t.getMonth() - 1, 1)
    const last = new Date(t.getFullYear(), t.getMonth(), 0)
    return { from: ymd(first), to: ymd(last) }
  }
  if (p === '30d') {
    const from = new Date(t); from.setDate(t.getDate() - 29)
    return { from: ymd(from), to: today }
  }
  if (p === 'quarter') {
    const q = Math.floor(t.getMonth() / 3)
    const first = new Date(t.getFullYear(), q * 3, 1)
    return { from: ymd(first), to: today }
  }
  return null
}

function detectPreset(from: string, to: string, today: string): RangePreset {
  for (const p of ['this_month', 'last_month', '30d', 'quarter'] as RangePreset[]) {
    const r = presetRange(p, today)
    if (r && r.from === from && r.to === to) return p
  }
  return 'custom'
}

export function RelatoriosTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const todayStr = businessDate()
  const firstOfMonth = `${todayStr.slice(0, 7)}-01`
  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [filterEmpId, setFilterEmpId] = useState('all')
  const [view, setView] = useState<'summary' | 'detailed'>('summary')
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [dayExceptions, setDayExceptions] = useState<string[]>([])
  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }
  const setPreset = (p: RangePreset) => {
    const r = presetRange(p, todayStr); if (r) { setFrom(r.from); setTo(r.to) }
  }
  const activePreset = detectPreset(from, to, todayStr)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (filterEmpId !== 'all') params.set('employeeId', filterEmpId)
      const [res, excRes] = await Promise.all([
        fetch(`/api/reports?${params}`),
        fetch(`/api/day-exceptions?from=${from}&to=${to}`),
      ])
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('error.connect')); return }
      const data: PunchRecord[] = await res.json()
      setRecords(data)
      setTruncated(data.length >= 2000)
      if (excRes.ok) {
        const exc: { date: string }[] = await excRes.json()
        setDayExceptions(exc.map(e => e.date))
      }
      setLoaded(true)
    } catch { setError(t('error.connect')) }
    finally { setLoading(false) }
  }, [from, to, filterEmpId, t])

  const sendEmailReport = async () => {
    setEmailSending(true); setEmailMsg(null)
    try {
      const d = new Date(from + 'T12:00:00')
      const res = await fetch('/api/cron/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: d.getFullYear(), month: d.getMonth() + 1 }),
      })
      const data = await res.json()
      if (res.ok) setEmailMsg({ ok: true, text: `Relatório enviado: ${data.sent} e-mail(s) entregue(s) — ${data.period}` })
      else setEmailMsg({ ok: false, text: data.error ?? t('error.connect') })
    } catch { setEmailMsg({ ok: false, text: t('error.connect') }) }
    finally { setEmailSending(false) }
  }

  const byEmp = useMemo(() => {
    const m: Record<string, { name: string; records: PunchRecord[] }> = {}
    records.forEach(r => {
      const currentName = employees.find(e => e.id === r.employee_id)?.name ?? r.employee_name
      if (!m[r.employee_id]) m[r.employee_id] = { name: currentName, records: [] }
      m[r.employee_id].records.push(r)
    })
    return m
  }, [records, employees])

  const summary = useMemo(() => {
    const rows = Object.entries(byEmp).map(([empId, { name, records: recs }]) => {
      const emp = employees.find(e => e.id === empId)
      const lunch = emp?.lunch_break_minutes ?? 0
      const workdayHours = emp?.workday_hours ?? 8
      const workedMin = calcWorkedMinutesPeriod(recs, lunch)
      const expectedMin = workdayHours * 60
      const overtime = calcOvertimePeriod(recs, expectedMin, lunch) ?? 0
      const days = new Set(recs.map(r => r.date)).size
      const earnings = emp?.hourly_rate != null ? (workedMin / 60) * Number(emp.hourly_rate) : null
      const incompleteDays = (() => {
        const byDate = new Map<string, PunchRecord[]>()
        recs.forEach(r => { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date)!.push(r) })
        let n = 0; byDate.forEach(d => { if (isIncompleteDay(d)) n++ })
        return n
      })()
      return { empId, emp, name, workedMin, expectedMin, overtime, days, earnings, incompleteDays, recs }
    })
    rows.sort((a, b) => b.workedMin - a.workedMin)
    return rows
  }, [byEmp, employees])

  const totals = useMemo(() => {
    const t = { workedMin: 0, expectedMin: 0, overtime: 0, days: 0, earnings: 0, withRate: 0 }
    summary.forEach(r => {
      t.workedMin += r.workedMin
      t.expectedMin += r.expectedMin * r.days
      t.overtime += r.overtime
      t.days += r.days
      if (r.earnings != null) { t.earnings += r.earnings; t.withRate += 1 }
    })
    return t
  }, [summary])

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.relatorios')}</div>
          <div className="page-sub">{from} → {to}</div>
        </div>
        <div className="page-actions">
          {loaded && records.length > 0 && (
            <>
              <button
                onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`, employees.map(e => ({ id: e.id, name: e.name, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })))}
                className="btn"
              ><IconDownload size={13}/> CSV</button>
              <button
                onClick={() => exportPDF(records, `ponto_${from}_${to}.pdf`, employees.map(e => ({ id: e.id, name: e.name, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })), `${from} a ${to}`)}
                className="btn"
              ><IconDownload size={13}/> PDF</button>
            </>
          )}
          <button onClick={sendEmailReport} disabled={emailSending} className="btn" title="Enviar relatório do período seleccionado por e-mail">
            {emailSending ? 'A enviar…' : '✉ E-mail'}
          </button>
          <button onClick={load} disabled={loading} className="btn primary">
            <IconRefresh size={13}/> {loading ? t('relat.generating') : 'Gerar'}
          </button>
        </div>
      </div>

      {emailMsg && (
        <div className={`alert-inline ${emailMsg.ok ? 'ok' : 'err'}`}>{emailMsg.text}</div>
      )}

      {/* Filters */}
      <div className="card">
        <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, flex: '0 0 auto' }}>
            <label>{t('relat.from')}</label>
            <input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: '0 0 auto' }}>
            <label>{t('relat.to')}</label>
            <input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label>{t('relat.employee')}</label>
            <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)} className="input">
              <option value="all">{t('relat.all')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 1 }}>
            <button className={`filter-pill${activePreset === 'this_month' ? ' active' : ''}`} onClick={() => setPreset('this_month')}>Mês atual</button>
            <button className={`filter-pill${activePreset === 'last_month' ? ' active' : ''}`} onClick={() => setPreset('last_month')}>Mês passado</button>
            <button className={`filter-pill${activePreset === '30d' ? ' active' : ''}`} onClick={() => setPreset('30d')}>Últimos 30d</button>
            <button className={`filter-pill${activePreset === 'quarter' ? ' active' : ''}`} onClick={() => setPreset('quarter')}>Trimestre</button>
          </div>
        </div>
        {error && <div style={{ padding: '0 20px 12px' }}><div className="alert-inline err">{error}</div></div>}
      </div>

      {loaded && !loading && (
        <>
          {truncated && (
            <div className="alert-inline warn">{t('relat.truncated')}</div>
          )}

          {records.length === 0 ? (
            <div className="card"><div className="empty"><div className="title">Sem registros no período</div><div className="desc">Ajuste o filtro e gere novamente.</div></div></div>
          ) : (
            <>
              {/* KPI grid */}
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kpi-label">Total de horas</div>
                  <div className="kpi-value tnum">{fmtCentesimal(totals.workedMin)}</div>
                  <div className="kpi-delta">{summary.length} {summary.length === 1 ? 'pessoa' : 'pessoas'} · {totals.days} dias</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Horas extras</div>
                  <div className={`kpi-value tnum`} style={{ color: totals.overtime >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                    {fmtCentesimalSigned(totals.overtime)}
                  </div>
                  <div className="kpi-delta">vs. jornada esperada</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Custo total</div>
                  <div className="kpi-value tnum">{fmtEur(totals.earnings)}</div>
                  <div className="kpi-delta">{totals.withRate} c/ valor/h</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Custo médio / dia</div>
                  <div className="kpi-value tnum">{totals.days > 0 ? fmtEur(totals.earnings / totals.days) : '—'}</div>
                  <div className="kpi-delta">{summary.length > 0 ? `${fmtCentesimal(Math.round(totals.workedMin / summary.length))} média / pessoa` : ''}</div>
                </div>
              </div>

              {/* Por funcionário */}
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Por funcionário</div>
                  <div className="seg">
                    <button className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>Resumo</button>
                    <button className={view === 'detailed' ? 'active' : ''} onClick={() => setView('detailed')}>Detalhado</button>
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th className="right">Dias</th>
                      <th className="right">Horas trabalhadas</th>
                      <th className="right">Jornada esperada</th>
                      <th className="right">Horas extras</th>
                      <th className="right">Ganhos</th>
                      {view === 'detailed' && <th className="right">Holerite</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map(r => (
                      <tr key={r.empId}>
                        <td>
                          <div className="cell-emp">
                            <div className={`avatar size-22 av-c${empColor(r.empId)}`}>{avatarInitials(r.name)}</div>
                            <div className="cell-emp-info">
                              <div className="cell-emp-name">{r.name}</div>
                              <div className="cell-emp-sub">
                                {r.emp?.workday_hours}h/dia
                                {r.incompleteDays > 0 && <span style={{ color: 'var(--danger-fg)', marginLeft: 6 }}>⚠ {r.incompleteDays} dia(s) incompletos</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="right tnum">{r.days}</td>
                        <td className="right tnum" style={{ fontWeight: 500 }}>{fmtCentesimal(r.workedMin)}</td>
                        <td className="right tnum muted">{fmtCentesimal(r.expectedMin * r.days)}</td>
                        <td className="right tnum" style={{ color: r.overtime >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                          {fmtCentesimalSigned(r.overtime)}
                        </td>
                        <td className="right tnum">{r.earnings != null ? fmtEur(r.earnings) : <span className="muted">—</span>}</td>
                        {view === 'detailed' && (
                          <td className="right">
                            <button
                              onClick={() => openPayslip(r.name, `${from} a ${to}`, r.recs, r.emp?.workday_hours ?? 8, r.emp?.lunch_break_minutes ?? 60, r.emp?.hourly_rate ?? null)}
                              className="btn ghost sm"
                            >📄</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)', fontWeight: 600 }}>
                      <td style={{ padding: 12, borderTop: '1px solid var(--border)' }}>Total</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>{totals.days}</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>{fmtCentesimal(totals.workedMin)}</td>
                      <td className="right tnum muted" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>{fmtCentesimal(totals.expectedMin)}</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--border)', color: totals.overtime >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        {fmtCentesimalSigned(totals.overtime)}
                      </td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--border)' }}>{fmtEur(totals.earnings)}</td>
                      {view === 'detailed' && <td style={{ borderTop: '1px solid var(--border)' }}></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Daily chart */}
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
                    // Round per (employee × day) so the chart bar agrees with the rounded daily values shown in the table below.
                    const dayExact = Math.max(0, calcNetMinutes(dayRecs, lMin))
                    totalMin += roundToQuarter(dayExact)
                  })
                  return { date, min: totalMin }
                })
                const maxMin = Math.max(...chartData.map(d => d.min), 1)
                return (
                  <div className="card">
                    <div className="card-head">
                      <div className="card-title">Horas por dia</div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 96 }}>
                        {chartData.map(({ date, min }) => {
                          const pct = Math.min(100, (min / maxMin) * 100)
                          const d = new Date(date + 'T12:00:00')
                          const label = `${pad(d.getDate())}/${pad(d.getMonth()+1)}: ${min > 0 ? fmtCentesimal(min) : t('relat.no_records')}`
                          return (
                            <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: pct > 0 ? `${pct}%` : 3, background: min === 0 ? 'var(--border)' : 'var(--accent)', opacity: min === 0 ? 1 : 0.7 }} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Absences */}
              {(() => {
                const workingDays = getWorkingDays(from, to).filter(d => !dayExceptions.includes(d))
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
                if (absences.length === 0) return null
                return (
                  <div className="card">
                    <div className="card-head"><div className="card-title">{t('relat.absences')}</div></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {absences.map(({ empName, dates }) => (
                        <div key={empName}>
                          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 4 }}>
                            {empName} <span style={{ color: 'var(--danger-fg)' }}>({dates.length} {dates.length > 1 ? t('relat.faults') : t('relat.fault')})</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {dates.map(d => {
                              const dt = new Date(d + 'T12:00:00')
                              return (
                                <span key={d} className="chip danger" style={{ fontSize: 10 }}>
                                  {pad(dt.getDate())}/{pad(dt.getMonth()+1)}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </>
      )}
    </>
  )
}
