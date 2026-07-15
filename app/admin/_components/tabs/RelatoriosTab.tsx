'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { exportCSV, exportPDF, fmtCentesimal, fmtCentesimalSigned, fmtEur, roundToQuarter, calcOvertimePeriod, calcWorkedMinutesPeriod, calcNetMinutes, businessDate, isIncompleteDay, avatarInitials } from '@/lib/utils'
import { targetMinutesForDate, isScheduledWorkday, calcPeriodPay, calcDayPay } from '@/lib/schedule'
import { empColor, getWorkingDays, openPayslip } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconDownload, IconRefresh } from '../icons'

interface PunctualityRow {
  empId: string; name: string; expected_start: string | null
  total_days: number; on_time: number; late: number; avg_late_min: number
}

function PunctualitySection({ from, to }: { from: string; to: string }) {
  const [rows, setRows] = useState<PunctualityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)

  const load = async () => {
    if (!open) { setOpen(true) }
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/punctuality?from=${from}&to=${to}`)
      if (res.ok) { setRows(await res.json()); setLoaded(true) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div
        className="card-head"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => { if (!open) load(); else setOpen(false) }}
      >
        <div className="card-title">Pontualidade {loaded && rows.length > 0 && <span className="chip" style={{ fontSize: 11, marginLeft: 6 }}>{rows.length} pessoas</span>}</div>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="card-body">
          {loading && <div className="alert-inline info">A carregar…</div>}
          {!loading && loaded && rows.length === 0 && (
            <div className="empty"><div className="desc">Nenhum dado de pontualidade no período. Configure o horário esperado por funcionário.</div></div>
          )}
          {!loading && loaded && rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-muted)' }}>Funcionário</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fg-muted)' }}>Esperado</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fg-muted)' }}>Dias</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fg-muted)' }}>Pontual</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fg-muted)' }}>Atraso</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--fg-muted)' }}>Média atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const pct = r.total_days > 0 ? Math.round((r.on_time / r.total_days) * 100) : 0
                    const h = Math.floor(r.avg_late_min / 60)
                    const m = r.avg_late_min % 60
                    return (
                      <tr key={r.empId} style={{ borderBottom: '1px solid var(--divider)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--fg-muted)' }}>{r.expected_start ?? '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.total_days}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span className={`chip ${pct >= 90 ? 'success' : pct >= 70 ? 'warn' : 'danger'}`} style={{ fontSize: 11 }}>{pct}%</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: r.late > 0 ? 'var(--danger-fg)' : 'var(--fg-muted)' }}>
                          {r.late > 0 ? `${r.late} vez${r.late > 1 ? 'es' : ''}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                          {r.avg_late_min > 0 ? (h > 0 ? `${h}h${String(m).padStart(2,'0')}m` : `${m}m`) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AbsenceRow {
  empId: string; name: string; absent_count: number; absent_days: string[]
}

function AbsencesSection({ from, to }: { from: string; to: string }) {
  const [rows, setRows] = useState<AbsenceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)

  const load = async () => {
    if (!open) { setOpen(true) }
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/absences?from=${from}&to=${to}`)
      if (res.ok) { setRows(await res.json()); setLoaded(true) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const padD = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="card">
      <div
        className="card-head"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => { if (!open) load(); else setOpen(false) }}
      >
        <div className="card-title">Ausências {loaded && rows.length > 0 && <span className="chip danger" style={{ fontSize: 11, marginLeft: 6 }}>{rows.length} pessoas</span>}</div>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="card-body">
          {loading && <div className="alert-inline info">A carregar…</div>}
          {!loading && loaded && rows.length === 0 && (
            <div className="empty"><div className="desc">Nenhuma ausência no período.</div></div>
          )}
          {!loading && loaded && rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-muted)' }}>Funcionário</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fg-muted)' }}>Ausências</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-muted)' }}>Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.empId} style={{ borderBottom: '1px solid var(--divider)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span className="chip danger" style={{ fontSize: 11 }}>{r.absent_count}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-muted)', fontSize: 12 }}>
                        {r.absent_days.map(d => {
                          const dt = new Date(d + 'T12:00:00')
                          return `${padD(dt.getDate())}/${padD(dt.getMonth() + 1)}`
                        }).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
  // #285 — company holidays inside the period + the tenant's pay-uplift opt-in.
  const [holidays, setHolidays] = useState<string[]>([])
  const [otMultipliers, setOtMultipliers] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Tenant pay-uplift opt-in loads once — it changes rarely and only in Ajustes.
  useEffect(() => {
    fetch('/api/tenant-settings')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setOtMultipliers(Boolean(d.overtime_multipliers)) })
      .catch(() => {})
  }, [])

  // Per-day pay with the art. 268.º uplifts, injected into exports/holerites so
  // every money figure agrees with the summary column.
  const dayPay = useMemo(() => {
    if (!otMultipliers) return undefined
    const holidaySet = new Set(holidays)
    const byId = new Map(employees.map(e => [e.id, e]))
    return (netMin: number, rate: number, date: string, empId: string) => {
      const sched = byId.get(empId) ?? { workday_hours: 8 }
      return calcDayPay(netMin, rate, {
        targetMin: targetMinutesForDate(sched, date),
        isRestDay: !isScheduledWorkday(sched, date),
        isHoliday: holidaySet.has(date),
      })
    }
  }, [otMultipliers, holidays, employees])

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }
  const setPreset = (p: RangePreset) => {
    const r = presetRange(p, todayStr); if (r) { setFrom(r.from); setTo(r.to) }
  }
  const activePreset = detectPreset(from, to, todayStr)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to, limit: '500' })
      if (filterEmpId !== 'all') params.set('employeeId', filterEmpId)
      const [res, excRes] = await Promise.all([
        fetch(`/api/reports?${params}&page=1`),
        fetch(`/api/day-exceptions?from=${from}&to=${to}`),
      ])
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('error.connect')); return }
      const json = await res.json()
      let allData: PunchRecord[] = json.data
      const { totalPages } = json.pagination as { totalPages: number }
      // Fetch remaining pages in parallel so large periods load completely
      if (totalPages > 1) {
        const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
        const rest = await Promise.all(
          pages.map(p => fetch(`/api/reports?${params}&page=${p}`).then(r => r.json()))
        )
        rest.forEach(j => { allData = allData.concat(j.data as PunchRecord[]) })
      }
      setRecords(allData)
      setTruncated(false)
      if (excRes.ok) {
        const exc: { date: string; type?: string; employee_id?: string | null }[] = await excRes.json()
        setDayExceptions(exc.map(e => e.date))
        setHolidays(exc.filter(e => e.type === 'holiday' && !e.employee_id).map(e => e.date))
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
      // Per-weekday target (#287): a scheduled 7h Saturday counts 7h, days off 0h.
      const schedEmp = emp ?? { workday_hours: workdayHours }
      const overtime = calcOvertimePeriod(recs, d => targetMinutesForDate(schedEmp, d), lunch) ?? 0
      const days = new Set(recs.map(r => r.date)).size
      // Flat mode gives the same figure as the old (workedMin/60)×rate; with the
      // tenant opt-in it applies the art. 268.º uplifts per day (#285).
      const earnings = emp?.hourly_rate != null
        ? calcPeriodPay(recs, { ...schedEmp, hourly_rate: Number(emp.hourly_rate) }, { multipliers: otMultipliers, holidays, lunchBreakMinutes: lunch })
        : null
      const incompleteDays = (() => {
        const byDate = new Map<string, PunchRecord[]>()
        recs.forEach(r => { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date)!.push(r) })
        let n = 0; byDate.forEach(d => { if (isIncompleteDay(d)) n++ })
        return n
      })()
      // Sum of the per-day targets over recorded days (identity: net − overtime),
      // so the 'Previsto' column agrees with schedule-aware overtime (#287).
      const targetSum = workedMin - overtime
      return { empId, emp, name, workedMin, expectedMin, targetSum, overtime, days, earnings, incompleteDays, recs }
    })
    rows.sort((a, b) => b.workedMin - a.workedMin)
    return rows
  }, [byEmp, employees, otMultipliers, holidays])

  const totals = useMemo(() => {
    const t = { workedMin: 0, expectedMin: 0, overtime: 0, days: 0, earnings: 0, withRate: 0 }
    summary.forEach(r => {
      t.workedMin += r.workedMin
      t.expectedMin += r.targetSum
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
                onClick={() => exportCSV(records, `ponto_${from}_${to}.csv`, employees.map(e => ({ id: e.id, name: e.name, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })), dayPay)}
                className="btn"
              ><IconDownload size={13}/> CSV</button>
              <button
                onClick={() => exportPDF(records, `ponto_${from}_${to}.pdf`, employees.map(e => ({ id: e.id, name: e.name, hourly_rate: e.hourly_rate, lunch_break_minutes: e.lunch_break_minutes })), `${from} a ${to}`, dayPay)}
                className="btn"
              ><IconDownload size={13}/> PDF</button>
              <a
                href={`/api/reports/calendar?from=${from}&to=${to}${filterEmpId !== 'all' ? `&employeeId=${filterEmpId}` : ''}`}
                download={`ponto_${from}_${to}.ics`}
                className="btn"
              ><IconDownload size={13}/> ICS</a>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 1 }}>
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
                        <td className="right tnum muted">{fmtCentesimal(r.targetSum)}</td>
                        <td className="right tnum" style={{ color: r.overtime >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                          {fmtCentesimalSigned(r.overtime)}
                        </td>
                        <td className="right tnum">{r.earnings != null ? fmtEur(r.earnings) : <span className="muted">—</span>}</td>
                        {view === 'detailed' && (
                          <td className="right">
                            <button
                              onClick={() => openPayslip(r.name, `${from} a ${to}`, r.recs, r.emp?.workday_hours ?? 8, r.emp?.lunch_break_minutes ?? 60, r.emp?.hourly_rate ?? null, dayPay ? (n, rt, d) => dayPay(n, rt, d, r.empId) : undefined)}
                              className="btn ghost sm"
                            >📄</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)', fontWeight: 600 }}>
                      <td style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>Total</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>{totals.days}</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>{fmtCentesimal(totals.workedMin)}</td>
                      <td className="right tnum muted" style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>{fmtCentesimal(totals.expectedMin)}</td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--divider)', color: totals.overtime >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        {fmtCentesimalSigned(totals.overtime)}
                      </td>
                      <td className="right tnum" style={{ padding: 12, borderTop: '1px solid var(--divider)' }}>{fmtEur(totals.earnings)}</td>
                      {view === 'detailed' && <td style={{ borderTop: '1px solid var(--divider)' }}></td>}
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

              {/* Pontualidade — lazy-loaded on demand */}
              <PunctualitySection from={from} to={to} />

              {/* Ausências — lazy-loaded on demand */}
              <AbsencesSection from={from} to={to} />
            </>
          )}
        </>
      )}
    </>
  )
}
