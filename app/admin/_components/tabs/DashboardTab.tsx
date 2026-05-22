'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { fmtMinutes, calcOvertimePeriod, calcNetMinutes, calcTimeBreakdown, WORKING_TYPES, openPayslip } from '@/lib/utils'
import { SL, getWorkingDays } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'

type EmpStatus = 'working' | 'pause' | 'out' | 'absent'

function getEmpStatus(recs: PunchRecord[]): EmpStatus {
  if (!recs.length) return 'absent'
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted.at(-1)!
  if (WORKING_TYPES.includes(last.type)) return 'working'
  if (last.type === 'inicio_almoco' || last.type === 'pausa_cafe') return 'pause'
  if (last.type === 'saída') return 'out'
  return 'absent'
}

const STATUS_COLOR: Record<EmpStatus, string> = {
  working: 'var(--success-fg)',
  pause: 'var(--warning)',
  out: 'var(--fg-muted)',
  absent: 'var(--danger-fg)',
}

const STATUS_CHIP: Record<EmpStatus, string> = {
  working: 'success',
  pause: 'warn',
  out: '',
  absent: 'danger',
}

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function empColor(id: string): number {
  return (id.charCodeAt(0) % 8) + 1
}

export function DashboardTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
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

  // Today's status per employee
  const todayByEmp = new Map<string, PunchRecord[]>()
  todayRecs.forEach(r => {
    if (!todayByEmp.has(r.employee_id)) todayByEmp.set(r.employee_id, [])
    todayByEmp.get(r.employee_id)!.push(r)
  })

  const empStatuses = employees.map(emp => ({
    emp,
    status: getEmpStatus(todayByEmp.get(emp.id) ?? []),
  }))

  const statusCounts = {
    working: empStatuses.filter(e => e.status === 'working').length,
    pause:   empStatuses.filter(e => e.status === 'pause').length,
    out:     empStatuses.filter(e => e.status === 'out').length,
    absent:  empStatuses.filter(e => e.status === 'absent').length,
  }

  // Monthly chart data
  const workingDays = getWorkingDays(firstOfMonth, todayStr)
  const byDateEmp = new Map<string, Map<string, PunchRecord[]>>()
  monthRecs.forEach(r => {
    if (!byDateEmp.has(r.date)) byDateEmp.set(r.date, new Map())
    const em = byDateEmp.get(r.date)!
    if (!em.has(r.employee_id)) em.set(r.employee_id, [])
    em.get(r.employee_id)!.push(r)
  })

  // Last 14 working days for chart (or all if fewer)
  const chartDays = workingDays.slice(-14)
  const chartData = chartDays.map(date => {
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

  // Monthly totals per employee
  const byEmpMonth: Record<string, PunchRecord[]> = {}
  monthRecs.forEach(r => {
    if (!byEmpMonth[r.employee_id]) byEmpMonth[r.employee_id] = []
    byEmpMonth[r.employee_id].push(r)
  })

  if (loading) return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 22, width: '40%' }} />
              <div className="skeleton skeleton-text" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton skeleton-avatar" style={{ width: 32, height: 32 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton skeleton-title" style={{ width: '45%' }} />
                <div className="skeleton skeleton-text" style={{ width: '30%' }} />
              </div>
              <div className="skeleton" style={{ width: 48, height: 20, borderRadius: 99 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* ── STATUS TODAY ─────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('dash.presence_today')} · {now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}</SL>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
            {((['working', 'pause', 'out', 'absent'] as EmpStatus[])).map(s => (
              <div key={s} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLOR[s], fontFamily: 'var(--font-mono)' }}>
                  {statusCounts[s]}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {t(('dash.status.' + s) as TranslationKey).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── EMPLOYEE STATUS LIST ─────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('dash.team_now')}</SL>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {empStatuses
              .sort((a, b) => {
                const order: EmpStatus[] = ['working', 'pause', 'out', 'absent']
                return order.indexOf(a.status) - order.indexOf(b.status)
              })
              .map(({ emp, status }) => {
                const recs = todayByEmp.get(emp.id) ?? []
                const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                const lastRec = sorted.at(-1)
                const since = lastRec ? new Date(lastRec.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : null
                return (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className={`avatar size-32 av-c${empColor(emp.id)}`} style={{ flexShrink: 0, fontSize: 11 }}>{initials(emp.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                      {since && (
                        <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                          {status === 'working' ? t('dash.since') : status === 'pause' ? t('dash.pause_since') : t('dash.left_at')} {since}
                        </div>
                      )}
                    </div>
                    <span className={`chip ${STATUS_CHIP[status]}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {t(('dash.status.' + status) as TranslationKey)}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* ── HOURS CHART ─────────────────────────────────────────────────── */}
      {chartDays.length >= 2 && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            <SL>{t('dash.hours_per_day')} — {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</SL>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                {chartData.map(({ date, min }) => {
                  const pct = Math.min(100, (min / maxChartMin) * 100)
                  const d = new Date(date + 'T12:00:00')
                  const isToday = date === todayStr
                  const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}: ${min > 0 ? fmtMinutes(min) : t('dash.no_records_bar')}`
                  return (
                    <div key={date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={label}>
                      <div style={{
                        width: '100%', borderRadius: '3px 3px 0 0',
                        height: pct > 0 ? `${pct}%` : 3,
                        background: min === 0 ? 'var(--border)' : isToday ? 'var(--accent)' : 'var(--accent)',
                        opacity: min === 0 ? 1 : isToday ? 1 : 0.55,
                        transition: 'height 0.3s',
                      }} />
                    </div>
                  )
                })}
              </div>
              {/* Day labels */}
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {chartData.map(({ date }) => {
                  const d = new Date(date + 'T12:00:00')
                  const isToday = date === todayStr
                  return (
                    <div key={date} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--fg-muted)', fontWeight: isToday ? 700 : 400 }}>
                      {DAYS_SHORT[d.getDay()]}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY PROGRESS PER EMPLOYEE ───────────────────────────────── */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('dash.month_progress')}</SL>
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
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                      {monthMin > 0 ? fmtMinutes(Math.round(monthMin)) : '—'}
                    </span>
                    {bank !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: bank >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        {bank >= 0 ? '+' : '-'}{fmtMinutes(Math.abs(bank))}
                      </span>
                    )}
                    <button
                      className="btn ghost sm"
                      style={{ fontSize: 10, padding: '2px 7px' }}
                      title={t('dash.month_progress') + ' PDF'}
                      onClick={() => {
                        const period = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
                        openPayslip(emp.name, period, empRecs, emp.workday_hours, emp.lunch_break_minutes ?? 60, emp.hourly_rate ?? null)
                      }}
                    >PDF</button>
                  </div>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', borderRadius: 999, height: 4 }}>
                  <div style={{
                    height: 4, borderRadius: 999, width: `${pct}%`,
                    background: pct >= 100 ? 'var(--success-fg)' : pct >= 75 ? 'var(--accent)' : 'var(--fg-subtle)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
