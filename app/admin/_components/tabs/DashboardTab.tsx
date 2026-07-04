'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Employee, PunchRecord, DayException } from '@/lib/types'
import { fmtMinutes, businessDate, businessMinutesOfDay, BUSINESS_TZ } from '@/lib/utils'
import type { DashboardSeed } from '../../_lib/types'
import { empColor, getWorkState, calcLiveMin, fmtMin, getWorkingDays } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { avatarInitials } from '@/lib/utils'
import {
  IconRefresh, IconArrowUp, IconArrowDown,
  IconPulse, IconEuro, IconClock, IconBank, IconCalendar,
} from '../icons'

function fmtCost(n: number): string {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 64, h = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - (v / max) * h * 0.9
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}

export function DashboardTab({ employees, initialData }: { employees: Employee[]; initialData?: DashboardSeed | null }) {
  const { t } = useLang()
  // The clock live counters and date windows derive from. Seeded from the server so
  // the SSR HTML and the hydration render compute identical strings; every load()
  // brings it back to the present. The derived date strings only change when the
  // business day flips, so they're stable useCallback deps.
  const [nowMs, setNowMs] = useState(() => initialData?.now ?? Date.now())
  const now = new Date(nowMs)
  const todayStr = businessDate(now)
  const next30Str = new Date(nowMs + 30 * 86400000).toISOString().split('T')[0]
  // Chart wants last 14 working days regardless of month boundary; 30 calendar days back
  // covers it comfortably even after long weekends.
  const chartFromStr = new Date(nowMs - 30 * 86400000).toISOString().split('T')[0]

  const [monthRecs, setMonthRecs] = useState<PunchRecord[]>(initialData?.monthRecs ?? [])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>(initialData?.todayRecs ?? [])
  const [exceptions, setExceptions] = useState<DayException[]>(initialData?.exceptions ?? [])
  const [bankBalances, setBankBalances] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(!initialData)
  // Day selected in the bar chart (null = default to the most recent day).
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // No setLoading(true) here: swapping the whole tab back to skeletons on every
  // 60s auto-refresh caused a visible flash and repeated layout shifts (CLS).
  // The skeleton only shows while there has never been data to render.
  const load = useCallback(async () => {
    setNowMs(Date.now())
    try {
      // limit matches the server seed's RANGE_CAP so a refresh never shows fewer
      // records than the first paint did.
      const [mRes, tRes, eRes] = await Promise.all([
        fetch(`/api/reports?from=${chartFromStr}&to=${todayStr}&limit=2000`),
        fetch('/api/records?today=true'),
        fetch(`/api/day-exceptions?from=${todayStr}&to=${next30Str}`),
      ])
      if (mRes.ok) setMonthRecs((await mRes.json()).data)
      if (tRes.ok) setTodayRecs(await tRes.json())
      if (eRes.ok) setExceptions(await eRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [chartFromStr, todayStr, next30Str])

  // Server-seeded data is fresh — skip the mount fetch and let the 60s interval
  // (or a manual refresh) take over. Later recreations of load() (day flip) still run.
  const seededRef = useRef(Boolean(initialData))
  useEffect(() => {
    if (seededRef.current) { seededRef.current = false; return }
    load()
  }, [load])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (employees.length === 0) return
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/hour-bank?all=true')
        if (res.ok) {
          const data: Record<string, number> = await res.json()
          setBankBalances(new Map(Object.entries(data)))
        }
      } catch { /* silent */ }
    }
    fetchAll()
  }, [employees])

  // Per-employee data — split into "today" (for live worked minutes / progress) and
  // "all recent" (month window, for state determination so an unclosed entrada from
  // yesterday still shows the employee as working today).
  const todayByEmp = useMemo(() => {
    const m = new Map<string, PunchRecord[]>()
    todayRecs.forEach(r => {
      if (!m.has(r.employee_id)) m.set(r.employee_id, [])
      m.get(r.employee_id)!.push(r)
    })
    return m
  }, [todayRecs])

  const recentByEmp = useMemo(() => {
    const m = new Map<string, PunchRecord[]>()
    monthRecs.forEach(r => {
      if (!m.has(r.employee_id)) m.set(r.employee_id, [])
      m.get(r.employee_id)!.push(r)
    })
    return m
  }, [monthRecs])

  const empData = useMemo(() => employees.map(emp => {
    const todayRecsEmp = todayByEmp.get(emp.id) ?? []
    const recentRecsEmp = recentByEmp.get(emp.id) ?? []
    // state from the broader window so unclosed prior-day entries register as working
    const stateSource = recentRecsEmp.length > 0 ? recentRecsEmp : todayRecsEmp
    const { state, since } = getWorkState(stateSource)
    const latestSorted = [...stateSource].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const latestRec = latestSorted.at(-1)
    const stateFromPriorDay = state !== 'off' && latestRec != null && latestRec.date !== todayStr
    // ...but only today's records contribute to today's worked minutes
    const liveMin = calcLiveMin(todayRecsEmp, emp.lunch_break_minutes ?? 60, nowMs)
    const targetMin = emp.workday_hours * 60
    const earnings = emp.hourly_rate ? (liveMin / 60) * emp.hourly_rate : null
    // Use todayRecsEmp for `recs` so downstream displays (count, history) still reflect today.
    return { emp, recs: todayRecsEmp, state, since, liveMin, targetMin, earnings, stateFromPriorDay, latestRec }
  }), [employees, todayByEmp, recentByEmp, todayStr, nowMs])

  // KPI values
  const { working, onBreak, absent, totalMinToday, totalEarnings } = useMemo(() => ({
    working:       empData.filter(e => e.state === 'working').length,
    onBreak:       empData.filter(e => e.state === 'lunch' || e.state === 'coffee').length,
    absent:        empData.filter(e => e.recs.length === 0).length,
    totalMinToday: empData.reduce((acc, e) => acc + e.liveMin, 0),
    totalEarnings: empData.reduce((acc, e) => acc + (e.earnings ?? 0), 0),
  }), [empData])

  const { totalBank, positiveBank, negativeBank } = useMemo(() => {
    const vals = Array.from(bankBalances.values())
    return {
      totalBank:    vals.reduce((a, b) => a + b, 0),
      positiveBank: vals.filter(v => v > 0).length,
      negativeBank: vals.filter(v => v < 0).length,
    }
  }, [bankBalances])

  // Chart: last 14 working days (going back from today, regardless of month boundary)
  const { chartDays, chartData, chartMax, chartValues, avgMin } = useMemo(() => {
    const workingDays = getWorkingDays(chartFromStr, todayStr)
    const chartDays = workingDays.slice(-14)
    const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
    monthRecs.forEach(r => {
      if (!byDateEmp.has(r.date)) byDateEmp.set(r.date, new Map())
      const em = byDateEmp.get(r.date)!
      if (!em.has(r.employee_id)) em.set(r.employee_id, [])
      em.get(r.employee_id)!.push(r)
    })
    const chartData = chartDays.map(date => {
      const empMap = byDateEmp.get(date)
      if (!empMap) return { date, min: 0 }
      let tot = 0
      empMap.forEach((recs, eid) => {
        const e = employees.find(x => x.id === eid)
        tot += calcLiveMin(recs, e?.lunch_break_minutes ?? 60, nowMs)
      })
      return { date, min: tot }
    })
    const chartMax = Math.max(...chartData.map(d => d.min), 1)
    const chartValues = chartData.map(d => d.min)
    const avgMin = chartValues.length ? Math.round(chartValues.reduce((a, b) => a + b, 0) / chartValues.length) : 0
    return { chartDays, chartData, chartMax, chartValues, avgMin }
  }, [monthRecs, employees, chartFromStr, todayStr, nowMs])

  const todayVsAvg = totalMinToday - avgMin

  // Upcoming exceptions (future, not today)
  const upcoming = useMemo(() => exceptions
    .filter(e => e.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4),
  [exceptions, todayStr])

  // Alerts: absent employees + late arrivals
  // "Truly absent" = no records today AND no open session from a prior day
  // (MissingExitBanner already flags the unclosed prior-day sessions separately).
  const { absentEmps, lateArrivals } = useMemo(() => {
    const absentEmps = empData.filter(e => e.recs.length === 0 && !e.stateFromPriorDay).slice(0, 4)
    const lateArrivals = empData
      .map(({ emp, recs }) => {
        if (!emp.expected_start || recs.length === 0) return null
        const firstEntrada = recs
          .filter(r => r.type === 'entrada')
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]
        if (!firstEntrada) return null
        const arrived = new Date(firstEntrada.timestamp)
        const [eh, em] = emp.expected_start.split(':').map(Number)
        // expected_start is a business-local wall time — compare in that timezone.
        // (setHours would use the runtime's TZ: UTC on the server, the viewer's on
        // the client, giving different "late" verdicts for the same punch.)
        const lateMin = Math.round(businessMinutesOfDay(arrived) - (eh * 60 + em))
        if (lateMin <= 5) return null // ignore on-time arrivals (up to 5min grace)
        const arrivedAt = arrived.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ })
        return { emp, lateMin, arrivedAt, expectedAt: emp.expected_start }
      })
      .filter((x): x is { emp: Employee; lateMin: number; arrivedAt: string; expectedAt: string } => x !== null)
      .sort((a, b) => b.lateMin - a.lateMin)
      .slice(0, 3)
    return { absentEmps, lateArrivals }
  }, [empData])
  const alertsCount = absentEmps.length + lateArrivals.length

  // Recent punches feed
  const recentPunches = useMemo(() => [...todayRecs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8),
  [todayRecs])

  // Activity table sorted by state (working first, then break, then out/absent)
  const sortedEmpData = useMemo(() => [...empData].sort((a, b) => {
    const order: Record<string, number> = { working: 0, lunch: 1, coffee: 1, off: 2 }
    const ao = order[a.state] ?? 3
    const bo = order[b.state] ?? 3
    if (ao !== bo) return ao - bo
    if (a.recs.length === 0 && b.recs.length > 0) return 1
    if (b.recs.length === 0 && a.recs.length > 0) return -1
    return 0
  }), [empData])

  const PUNCH_LABEL: Record<string, string> = {
    entrada:       t('punch.entrada'),
    'saída':       t('punch.saída'),
    inicio_almoco: t('punch.inicio_almoco'),
    fim_almoco:    t('punch.fim_almoco'),
    pausa_cafe:    t('punch.pausa_cafe'),
    retorno_cafe:  t('punch.retorno_cafe'),
  }
  const PUNCH_TONE: Record<string, string> = {
    entrada: 'success', 'saída': '', inicio_almoco: 'warn',
    fim_almoco: 'warn', pausa_cafe: 'accent', retorno_cafe: 'accent',
  }

  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  }

  const fmtDateLong = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    const s = d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // Effective selected day for the chart readout (defaults to the latest day).
  const selDate = selectedDate ?? chartData[chartData.length - 1]?.date
  const selBar = chartData.find(d => d.date === selDate) ?? null

  if (loading) return (
    <>
      <div className="kpi-grid">
        {[0,1,2,3].map(i => (
          <div key={i} className="kpi">
            <div className="skeleton skeleton-text" style={{ width: '55%' }} />
            <div className="skeleton" style={{ height: 32, width: '40%', marginTop: 4 }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="skeleton skeleton-avatar" style={{ width: 28, height: 28 }} />
              <div style={{ flex: 1 }}><div className="skeleton skeleton-text" style={{ width: '45%' }} /></div>
              <div className="skeleton" style={{ width: 56, height: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', timeZone: BUSINESS_TZ })}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>
            <IconRefresh size={13} /> {t('dash.refresh_btn')}
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {/* 1 - Working now */}
        <div className="kpi">
          <div className="kpi-label"><IconPulse size={12} /> {t('dash.working_now')}</div>
          <div className="kpi-value tnum">
            {working}
            <span style={{ fontSize: 14, color: 'var(--fg-subtle)', fontWeight: 500 }}> / {employees.length}</span>
          </div>
          <div className="kpi-delta" style={{ gap: 6 }}>
            {onBreak > 0 && <span className="chip warn dot">{onBreak} {t('dash.on_break')}</span>}
            {absent > 0 && <span className="chip outline">{absent} {t('dash.no_reg')}</span>}
          </div>
        </div>

        {/* 2 - Hours today */}
        <div className="kpi">
          <div className="kpi-label"><IconClock size={12} /> {t('dash.hours_today')}</div>
          <div className="kpi-value tnum">{fmtMin(totalMinToday)}</div>
          <div className={`kpi-delta${todayVsAvg >= 0 ? ' up' : ' down'}`}>
            {todayVsAvg >= 0 ? <IconArrowUp size={11}/> : <IconArrowDown size={11}/>}
            {fmtMin(Math.abs(todayVsAvg))} {t('dash.vs_avg')}
          </div>
          <div className="kpi-spark">
            <Sparkline values={chartValues} />
          </div>
        </div>

        {/* 3 - Cost today */}
        <div className="kpi">
          <div className="kpi-label"><IconEuro size={12} /> {t('dash.cost_today')}</div>
          <div className="kpi-value tnum">{fmtCost(totalEarnings)}</div>
          <div className="kpi-delta">
            {t('dash.cost_est').replace('{n}', String(employees.filter(e => e.hourly_rate).length))}
          </div>
        </div>

        {/* 4 - Hour bank */}
        <div className="kpi">
          <div className="kpi-label"><IconBank size={12} /> {t('dash.hour_bank')}</div>
          <div className="kpi-value tnum" style={{ color: totalBank >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
            {totalBank >= 0 ? '+' : ''}{fmtMin(totalBank)}
          </div>
          <div className="kpi-delta" style={{ gap: 6 }}>
            {positiveBank > 0 && <span className="chip success">{positiveBank} {t('dash.positives')}</span>}
            {negativeBank > 0 && <span className="chip danger">{negativeBank} {t('dash.negatives')}</span>}
          </div>
        </div>
      </div>

      {/* Activity live + right column */}
      <div className="grid-3">
        {/* Activity table */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t('dash.live_activity')}</div>
              <div className="card-sub">{t('dash.refresh_btn')}</div>
            </div>
          </div>
          <div className="card-body flush">
            {sortedEmpData
              .slice(0, 8)
              .map(({ emp, recs, state, since, liveMin, targetMin, earnings, stateFromPriorDay }) => {
                const pct = Math.min(100, targetMin > 0 ? (liveMin / targetMin) * 100 : 0)
                const isOver = liveMin > targetMin
                const ci = empColor(emp.id)
                return (
                  <div key={emp.id} className="status-row">
                    <div className="cell-emp" style={{ minWidth: 0 }}>
                      <div className={`avatar size-28 av-c${ci}`}>{avatarInitials(emp.name)}</div>
                      <div className="cell-emp-info">
                        <div className="cell-emp-name">{emp.name}</div>
                        <div className="cell-emp-sub">
                          {state === 'working' && since && <>{t('dash.since')} {since}{stateFromPriorDay && <span style={{ color: 'var(--warning-fg)' }}> · {t('dash.no_prev_exit')}</span>}</>}
                          {state === 'lunch'   && since && <>{t('dash.since')} {since}{stateFromPriorDay && ` ${t('dash.yesterday')}`}</>}
                          {state === 'coffee'  && since && <>{t('dash.since')} {since}{stateFromPriorDay && ` ${t('dash.yesterday')}`}</>}
                          {state === 'off' && since && <>{t('dash.left_at')} {since}</>}
                          {recs.length === 0 && <>{t('dash.no_reg_today')}</>}
                        </div>
                      </div>
                    </div>
                    <div data-col="time" style={{ width: 110, textAlign: 'right', fontSize: 12, flexShrink: 0 }} className="tnum muted">
                      {fmtMin(liveMin)} / {emp.workday_hours}h
                    </div>
                    <div data-col="bar" style={{ width: 80, flexShrink: 0 }}>
                      <div className="bar">
                        <div className={`bar-fill${isOver ? ' over' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div data-col="chip" style={{ width: 90, flexShrink: 0 }}>
                      {state === 'working' && <span className="chip success">{t('dash.state.active')}</span>}
                      {state === 'lunch'   && <span className="chip warn">{t('dash.state.lunch')}</span>}
                      {state === 'coffee'  && <span className="chip warn">{t('dash.state.coffee')}</span>}
                      {state === 'off' && recs.length > 0 && <span className="chip outline">{t('dash.state.off')}</span>}
                      {recs.length === 0 && <span className="chip outline">—</span>}
                    </div>
                    <div data-col="earnings" style={{ width: 80, textAlign: 'right', flexShrink: 0 }} className="tnum muted">
                      {earnings !== null ? fmtCost(earnings) : '—'}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upcoming events */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t('dash.upcoming')}</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                  {t('dash.no_upcoming')}
                </div>
              ) : (
                upcoming.map(exc => {
                  const [day, mon] = fmtDate(exc.date).split(' ')
                  return (
                    <div key={exc.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 44, padding: '6px 0', flexShrink: 0,
                        background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
                        textAlign: 'center', border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 11 }} className="tnum">{day}</div>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>{mon}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{exc.description}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                          {exc.type === 'holiday' ? t('dash.exc.holiday') : exc.employee_id ? t('dash.exc.individual') : t('dash.exc.company')}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Alerts */}
          {alertsCount > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">{t('dash.alerts')}</div>
                <span className="chip warn">{alertsCount}</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lateArrivals.map(({ emp, lateMin, arrivedAt, expectedAt }) => {
                  const h = Math.floor(lateMin / 60), m = lateMin % 60
                  const lateLabel = h > 0 ? `${h}h${m > 0 ? `${m}` : ''}` : `${m}min`
                  return (
                    <div key={`late-${emp.id}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                        background: 'var(--warning)',
                      }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name} {t('dash.arrived_late').replace('{label}', lateLabel)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                          {t('dash.punched_at').replace('{time}', arrivedAt).replace('{expected}', expectedAt)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {absentEmps.map(({ emp }) => (
                  <div key={emp.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: 'var(--danger-fg)',
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name} {t('dash.no_reg_today')}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                        {t('dash.no_punch_row')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart + Recent punches */}
      <div className="grid-3">
        {/* Bar chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div className="card-title">{t('dash.chart_title').replace('{n}', String(chartDays.length))}</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Readout of the selected day — updates on tap so the bars become legible */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
                  {selBar && selBar.min > 0 ? fmtMinutes(selBar.min) : '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 3 }}>
                  {selDate ? fmtDateLong(selDate) : ''}
                  {selDate === todayStr && (
                    <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{t('dash.chart_today')}</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{t('dash.chart_avg')}</div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 600 }}>{fmtMinutes(avgMin)}</div>
              </div>
            </div>

            <div style={{ height: 150, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {/* average reference line for context */}
                {avgMin > 0 && (
                  <div
                    aria-hidden
                    style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avgMin / chartMax) * 100}%`, borderTop: '1px dashed var(--border)', opacity: 0.7, pointerEvents: 'none' }}
                  />
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                  {chartData.map(({ date, min }) => {
                    const pct = (min / chartMax) * 100
                    const isSel = date === selDate
                    return (
                      <button
                        key={`bar-${date}`}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        aria-pressed={isSel}
                        aria-label={`${fmtDate(date)}: ${min > 0 ? fmtMinutes(min) : t('dash.no_records')}`}
                        style={{ flex: 1, maxWidth: 40, height: '100%', display: 'flex', alignItems: 'flex-end', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(pct, 3)}%`, minHeight: 3,
                            background: 'var(--accent)',
                            opacity: isSel ? 1 : 0.4,
                            borderRadius: 'var(--r-xs) var(--r-xs) 0 0',
                            transition: 'opacity 0.2s ease, height 0.4s ease',
                          }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                {chartData.map(({ date }) => {
                  const d = new Date(date + 'T12:00:00')
                  const isSel = date === selDate
                  return (
                    <div
                      key={`lbl-${date}`}
                      style={{ flex: 1, maxWidth: 40, textAlign: 'center', fontSize: 10, color: isSel ? 'var(--accent)' : 'var(--fg-subtle)', fontWeight: isSel ? 700 : 400 }}
                      className="tnum"
                    >
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent punches */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t('dash.last_punches')}</div>
          </div>
          <div className="card-body flush">
            {recentPunches.length === 0 ? (
              <div className="empty">
                <div className="desc">{t('dash.no_punches_today')}</div>
              </div>
            ) : recentPunches.map(r => {
              const emp = employees.find(e => e.id === r.employee_id)
              const ci = emp ? empColor(emp.id) : 1
              const time = new Date(r.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ })
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div className={`avatar av-c${ci}`}>{avatarInitials(r.employee_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.employee_name}</div>
                    <div style={{ marginTop: 2 }}>
                      <span className={`chip ${PUNCH_TONE[r.type] || 'outline'}`} style={{ fontSize: 11 }}>
                        {PUNCH_LABEL[r.type] ?? r.type}
                      </span>
                    </div>
                  </div>
                  <div className="tnum muted" style={{ fontSize: 11.5 }}>{time}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
