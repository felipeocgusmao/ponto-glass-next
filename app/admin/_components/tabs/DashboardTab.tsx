'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord, DayException } from '@/lib/types'
import { fmtMinutes, businessDate } from '@/lib/utils'
import { empColor, getWorkState, calcLiveMin, fmtMin, getWorkingDays } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { avatarInitials } from '@/lib/utils'
import {
  IconRefresh, IconArrowUp, IconArrowDown,
  IconPulse, IconEuro, IconClock, IconBank, IconCalendar,
  IconAlertTriangle, IconArrowRight,
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

export function DashboardTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const now = new Date()
  const todayStr = businessDate()
  const next30Str = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
  // Chart wants last 14 working days regardless of month boundary; 30 calendar days back
  // covers it comfortably even after long weekends.
  const chartFromStr = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

  const [monthRecs, setMonthRecs] = useState<PunchRecord[]>([])
  const [todayRecs, setTodayRecs] = useState<PunchRecord[]>([])
  const [exceptions, setExceptions] = useState<DayException[]>([])
  const [bankBalances, setBankBalances] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, tRes, eRes] = await Promise.all([
        fetch(`/api/reports?from=${chartFromStr}&to=${todayStr}`),
        fetch('/api/records?today=true'),
        fetch(`/api/day-exceptions?from=${todayStr}&to=${next30Str}`),
      ])
      if (mRes.ok) setMonthRecs(await mRes.json())
      if (tRes.ok) setTodayRecs(await tRes.json())
      if (eRes.ok) setExceptions(await eRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [chartFromStr, todayStr, next30Str])

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

  // Per-employee data — split into "today" (for live worked minutes / progress) and
  // "all recent" (month window, for state determination so an unclosed entrada from
  // yesterday still shows the employee as working today).
  const todayByEmp = new Map<string, PunchRecord[]>()
  todayRecs.forEach(r => {
    if (!todayByEmp.has(r.employee_id)) todayByEmp.set(r.employee_id, [])
    todayByEmp.get(r.employee_id)!.push(r)
  })
  const recentByEmp = new Map<string, PunchRecord[]>()
  monthRecs.forEach(r => {
    if (!recentByEmp.has(r.employee_id)) recentByEmp.set(r.employee_id, [])
    recentByEmp.get(r.employee_id)!.push(r)
  })

  const empData = employees.map(emp => {
    const todayRecsEmp = todayByEmp.get(emp.id) ?? []
    const recentRecsEmp = recentByEmp.get(emp.id) ?? []
    // state from the broader window so unclosed prior-day entries register as working
    const stateSource = recentRecsEmp.length > 0 ? recentRecsEmp : todayRecsEmp
    const { state, since } = getWorkState(stateSource)
    const latestSorted = [...stateSource].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const latestRec = latestSorted.at(-1)
    const stateFromPriorDay = state !== 'off' && latestRec != null && latestRec.date !== todayStr
    // ...but only today's records contribute to today's worked minutes
    const liveMin = calcLiveMin(todayRecsEmp, emp.lunch_break_minutes ?? 60)
    const targetMin = emp.workday_hours * 60
    const earnings = emp.hourly_rate ? (liveMin / 60) * emp.hourly_rate : null
    // Use todayRecsEmp for `recs` so downstream displays (count, history) still reflect today.
    return { emp, recs: todayRecsEmp, state, since, liveMin, targetMin, earnings, stateFromPriorDay, latestRec }
  })

  // KPI values
  const working = empData.filter(e => e.state === 'working').length
  const onBreak = empData.filter(e => e.state === 'lunch' || e.state === 'coffee').length
  const absent  = empData.filter(e => e.recs.length === 0).length
  const totalMinToday = empData.reduce((acc, e) => acc + e.liveMin, 0)
  const totalEarnings = empData.reduce((acc, e) => acc + (e.earnings ?? 0), 0)
  const bankValues = Array.from(bankBalances.values())
  const totalBank  = bankValues.reduce((a, b) => a + b, 0)
  const positiveBank = bankValues.filter(v => v > 0).length
  const negativeBank = bankValues.filter(v => v < 0).length

  // Chart: last 14 working days (going back from today, regardless of month boundary)
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
      tot += calcLiveMin(recs, e?.lunch_break_minutes ?? 60)
    })
    return { date, min: tot }
  })
  const chartMax = Math.max(...chartData.map(d => d.min), 1)
  const chartValues = chartData.map(d => d.min)
  const avgMin = chartValues.length ? Math.round(chartValues.reduce((a, b) => a + b, 0) / chartValues.length) : 0
  const todayVsAvg = totalMinToday - avgMin

  // Upcoming exceptions (future, not today)
  const upcoming = exceptions
    .filter(e => e.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  // Alerts: absent employees + late arrivals
  // "Truly absent" = no records today AND no open session from a prior day
  // (MissingExitBanner already flags the unclosed prior-day sessions separately).
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
      const expectedToday = new Date(arrived)
      expectedToday.setHours(eh, em, 0, 0)
      const lateMin = Math.round((arrived.getTime() - expectedToday.getTime()) / 60_000)
      if (lateMin <= 5) return null // ignore on-time arrivals (up to 5min grace)
      const arrivedAt = arrived.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      return { emp, lateMin, arrivedAt, expectedAt: emp.expected_start }
    })
    .filter((x): x is { emp: Employee; lateMin: number; arrivedAt: string; expectedAt: string } => x !== null)
    .sort((a, b) => b.lateMin - a.lateMin)
    .slice(0, 3)
  const alertsCount = absentEmps.length + lateArrivals.length

  // Recent punches feed
  const recentPunches = [...todayRecs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  const PUNCH_LABEL: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
    pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
  }
  const PUNCH_TONE: Record<string, string> = {
    entrada: 'success', 'saída': '', inicio_almoco: 'warn',
    fim_almoco: 'warn', pausa_cafe: 'accent', retorno_cafe: 'accent',
  }

  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  }

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
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>
            <IconRefresh size={13} /> {t('common.retry').replace('Tentar novamente', 'Atualizar')}
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {/* 1 - Working now */}
        <div className="kpi">
          <div className="kpi-label"><IconPulse size={12} /> Trabalhando agora</div>
          <div className="kpi-value tnum">
            {working}
            <span style={{ fontSize: 14, color: 'var(--fg-subtle)', fontWeight: 500 }}> / {employees.length}</span>
          </div>
          <div className="kpi-delta" style={{ gap: 6 }}>
            {onBreak > 0 && <span className="chip warn dot">{onBreak} em pausa</span>}
            {absent > 0 && <span className="chip outline">{absent} sem registro</span>}
          </div>
        </div>

        {/* 2 - Hours today */}
        <div className="kpi">
          <div className="kpi-label"><IconClock size={12} /> Horas registadas hoje</div>
          <div className="kpi-value tnum">{fmtMin(totalMinToday)}</div>
          <div className={`kpi-delta${todayVsAvg >= 0 ? ' up' : ' down'}`}>
            {todayVsAvg >= 0 ? <IconArrowUp size={11}/> : <IconArrowDown size={11}/>}
            {fmtMin(Math.abs(todayVsAvg))} vs. média
          </div>
          <div className="kpi-spark">
            <Sparkline values={chartValues} />
          </div>
        </div>

        {/* 3 - Cost today */}
        <div className="kpi">
          <div className="kpi-label"><IconEuro size={12} /> Custos do dia</div>
          <div className="kpi-value tnum">{fmtCost(totalEarnings)}</div>
          <div className="kpi-delta">
            Estimativa · {employees.filter(e => e.hourly_rate).length} c/ valor/h
          </div>
        </div>

        {/* 4 - Hour bank */}
        <div className="kpi">
          <div className="kpi-label"><IconBank size={12} /> Banco de horas</div>
          <div className="kpi-value tnum" style={{ color: totalBank >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
            {totalBank >= 0 ? '+' : ''}{fmtMin(totalBank)}
          </div>
          <div className="kpi-delta" style={{ gap: 6 }}>
            {positiveBank > 0 && <span className="chip success">{positiveBank} positivos</span>}
            {negativeBank > 0 && <span className="chip danger">{negativeBank} negativos</span>}
          </div>
        </div>
      </div>

      {/* Activity live + right column */}
      <div className="grid-3">
        {/* Activity table */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Atividade ao vivo</div>
              <div className="card-sub">Atualiza ao recarregar</div>
            </div>
          </div>
          <div className="card-body flush">
            {empData
              .sort((a, b) => {
                const order: Record<string, number> = { working: 0, lunch: 1, coffee: 1, off: 2 }
                const ao = order[a.state] ?? 3
                const bo = order[b.state] ?? 3
                if (ao !== bo) return ao - bo
                if (a.recs.length === 0 && b.recs.length > 0) return 1
                if (b.recs.length === 0 && a.recs.length > 0) return -1
                return 0
              })
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
                          {state === 'working' && since && <>desde {since}{stateFromPriorDay && <span style={{ color: 'var(--warning-fg)' }}> · sem saída anterior</span>}</>}
                          {state === 'lunch'   && since && <>almoço desde {since}{stateFromPriorDay && ' (ontem)'}</>}
                          {state === 'coffee'  && since && <>pausa café desde {since}{stateFromPriorDay && ' (ontem)'}</>}
                          {state === 'off' && since && <>saiu às {since}</>}
                          {recs.length === 0 && <>sem registro hoje</>}
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
                      {state === 'working' && <span className="chip success">Ativo</span>}
                      {state === 'lunch'   && <span className="chip warn">Almoço</span>}
                      {state === 'coffee'  && <span className="chip warn">Pausa</span>}
                      {state === 'off' && recs.length > 0 && <span className="chip outline">Saiu</span>}
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
              <div className="card-title">Próximos eventos</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                  Nenhum feriado ou folga nos próximos 30 dias.
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
                          {exc.type === 'holiday' ? 'Feriado' : exc.employee_id ? 'Folga individual' : 'Folga empresa'}
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
                <div className="card-title">Atenção</div>
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
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name} chegou {lateLabel} atrasado</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                          bateu às {arrivedAt} · esperado {expectedAt}
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
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name} sem registro hoje</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                        Nenhuma batida registada
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
            <div className="card-title">Horas trabalhadas · últimos {chartDays.length} dias úteis</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1 }}>
            {/* Split the chart into a bars row (flex:1 → has a resolvable height for the % bars)
                and a labels row, so the bars actually render. Previously each column was
                flex-direction: column with the bar using height: X% inside an auto-height
                parent — the percentage didn't resolve and the bars never appeared. */}
            <div style={{ height: 160, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, minHeight: 0 }}>
                {chartData.map(({ date, min }) => {
                  const pct = (min / chartMax) * 100
                  const isToday = date === todayStr
                  return (
                    <div
                      key={`bar-${date}`}
                      style={{
                        flex: 1, maxWidth: 40,
                        height: `${Math.max(pct, 3)}%`,
                        background: isToday ? 'var(--accent)' : 'var(--accent-soft)',
                        borderRadius: 'var(--r-xs) var(--r-xs) 0 0',
                        transition: 'height 0.4s ease',
                      }}
                      title={`${fmtDate(date)}: ${min > 0 ? fmtMinutes(min) : 'sem registros'}`}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                {chartData.map(({ date }) => {
                  const d = new Date(date + 'T12:00:00')
                  const isToday = date === todayStr
                  return (
                    <div
                      key={`lbl-${date}`}
                      style={{ flex: 1, maxWidth: 40, textAlign: 'center', fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--fg-subtle)', fontWeight: isToday ? 700 : 400 }}
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
            <div className="card-title">Últimas batidas</div>
          </div>
          <div className="card-body flush">
            {recentPunches.length === 0 ? (
              <div className="empty">
                <div className="desc">Nenhuma batida hoje.</div>
              </div>
            ) : recentPunches.map(r => {
              const emp = employees.find(e => e.id === r.employee_id)
              const ci = emp ? empColor(emp.id) : 1
              const time = new Date(r.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
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
