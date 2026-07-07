'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { avatarInitials, fmtMinutes, calcNetMinutes, calcTimeBreakdown, calcOvertimePeriod, WORKING_TYPES, EXPLICIT_BREAK_TYPES, businessDate } from '@/lib/utils'
import { empColor } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconRefresh } from '../icons'

type StatusFilter = 'all' | 'working' | 'break' | 'out' | 'absent'
type ViewMode = 'list' | 'grid'

function FilterPill({ id, label, count, tone, active, onClick }: {
  id: StatusFilter; label: string; count: number; tone?: string
  active: boolean; onClick: (id: StatusFilter) => void
}) {
  return (
    <button className={`filter-pill${active ? ' active' : ''}`} onClick={() => onClick(id)}>
      {tone && <span className="dot" style={{ background: tone === 'success' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--fg-dim)', width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />}
      <span className="val">{label}</span>
      <span className="key tnum">{count}</span>
    </button>
  )
}

export function StatusTab({ employees, currentUserId }: { employees: Employee[]; currentUserId: string }) {
  const { t } = useLang()
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const [punching, setPunching] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; kind: 'success' | 'error'; text: string } | null>(null)
  const [weekRecords, setWeekRecords] = useState<PunchRecord[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<ViewMode>('list')

  const loadSeq = useRef(0)
  const today = businessDate()
  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      // Load yesterday + today so unclosed entradas from the previous business day still
      // count as "working" today — admin can then close the missing saída straight from here.
      const anchor = new Date(`${today}T12:00:00Z`)
      const yest = new Date(anchor); yest.setUTCDate(anchor.getUTCDate() - 1)
      const from = yest.toISOString().split('T')[0]
      const res = await fetch(`/api/reports?from=${from}&to=${today}`)
      if (res.ok) {
        const { data } = await res.json()
        // Ignore out-of-order responses so a slow interval fetch can't revert a fresh punch.
        if (seq === loadSeq.current) setRecords(data)
      }
    } catch { /* keep current */ }
  }, [today])

  const loadWeek = useCallback(async () => {
    // Anchor on the business-timezone day at noon UTC (DST-safe) so Monday→yesterday
    // shifts correctly even if the tab stays open across midnight.
    const anchor = new Date(`${businessDate()}T12:00:00Z`)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const dow = anchor.getUTCDay()
    const monday = new Date(anchor); monday.setUTCDate(anchor.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    const yesterday = new Date(anchor); yesterday.setUTCDate(anchor.getUTCDate() - 1)
    if (fmt(yesterday) < fmt(monday)) { setWeekRecords([]); return }
    try {
      const res = await fetch(`/api/reports?from=${fmt(monday)}&to=${fmt(yesterday)}`)
      if (res.ok) setWeekRecords((await res.json()).data)
    } catch { /* keep current */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadWeek() }, [loadWeek])
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') setLiveMs(Date.now()) }, 30_000)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60_000)
    return () => clearInterval(iv)
  }, [load])
  // Refresh the weekly window too, so it stays correct if the tab is left open past midnight.
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') loadWeek() }, 60_000)
    return () => clearInterval(iv)
  }, [loadWeek])

  const handlePunch = async (emp: Employee, type: 'entrada' | 'saída') => {
    setPunching(emp.id); setMsg(null)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, employeeId: emp.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ id: emp.id, kind: 'success', text: type === 'entrada' ? t('status.registered_in') : t('status.registered_out') })
        await load()
      } else {
        setMsg({ id: emp.id, kind: 'error', text: data.error ?? t('punch.error_register') })
      }
    } catch {
      setMsg({ id: emp.id, kind: 'error', text: t('ponto.connect_error') })
    } finally {
      setPunching(null)
      setTimeout(() => setMsg(m => m?.id === emp.id ? null : m), 3_000)
    }
  }

  // `records` now spans yesterday + today, so we can detect open sessions from yesterday.
  // Today-only is what counts toward "horas hoje" and the daily progress bar.
  const { recordsAllByEmp, recordsTodayByEmp } = useMemo(() => {
    const recordsAllByEmp = new Map<string, PunchRecord[]>()
    const recordsTodayByEmp = new Map<string, PunchRecord[]>()
    records.forEach(r => {
      if (!recordsAllByEmp.has(r.employee_id)) recordsAllByEmp.set(r.employee_id, [])
      recordsAllByEmp.get(r.employee_id)!.push(r)
      if (r.date === today) {
        if (!recordsTodayByEmp.has(r.employee_id)) recordsTodayByEmp.set(r.employee_id, [])
        recordsTodayByEmp.get(r.employee_id)!.push(r)
      }
    })
    return { recordsAllByEmp, recordsTodayByEmp }
  }, [records, today])

  const weekByEmp = useMemo(() => {
    const m = new Map<string, PunchRecord[]>()
    weekRecords.forEach(r => {
      if (!m.has(r.employee_id)) m.set(r.employee_id, [])
      m.get(r.employee_id)!.push(r)
    })
    return m
  }, [weekRecords])

  const workers = useMemo(() => employees.filter(e => e.id !== currentUserId), [employees, currentUserId])

  const statuses = useMemo(() => workers.map(emp => {
    const empAll   = recordsAllByEmp.get(emp.id) ?? []
    const empToday = recordsTodayByEmp.get(emp.id) ?? []
    // State is determined by the latest record across the loaded window so an unclosed
    // entrada from yesterday correctly shows the employee as "working" today.
    const sortedAll = [...empAll].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastRecord = sortedAll.at(-1)
    const lastType = lastRecord?.type
    const isWorking = lastType != null && WORKING_TYPES.includes(lastType)
    const isOnLunch = lastType === 'inicio_almoco'
    const isOnCafe  = lastType === 'pausa_cafe'
    const isIn = isWorking || isOnLunch || isOnCafe
    const stateFromPriorDay = isIn && lastRecord != null && lastRecord.date !== today

    // Today's worked minutes uses only today's records — yesterday's open session does not
    // credit time to today.
    const sortedToday = [...empToday].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const hasBreaks = empToday.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
    let liveNetMin = 0
    if (hasBreaks) {
      const bd = calcTimeBreakdown(empToday)
      const completed = bd.workedMin + bd.coffeeMin
      // Lunch is unpaid — don't add ongoing time while on lunch.
      const isActive = (isWorking || isOnCafe) && !stateFromPriorDay
      const lastActive = isActive ? sortedToday.at(-1) : undefined
      const ongoingMin = lastActive ? (liveMs - new Date(lastActive.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, completed + ongoingMin)
    } else {
      const lastEntry = isWorking && !stateFromPriorDay ? sortedToday.slice().reverse().find(r => r.type === 'entrada') : undefined
      const currentSessionMin = lastEntry ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000 : 0
      // Show gross elapsed time while the worker is still IN; only subtract the
      // assumed lunch once they've punched out (matches reports/payslip logic).
      const lunchDeduction = isWorking ? 0 : emp.lunch_break_minutes
      liveNetMin = Math.max(0, calcNetMinutes(empToday, 0) + currentSessionMin - lunchDeduction)
    }
    const liveEarnings = emp.hourly_rate && liveNetMin > 0
      ? ((liveNetMin / 60) * emp.hourly_rate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
      : null
    const pastWeekRecs = weekByEmp.get(emp.id) ?? []
    const pastWeekMin = pastWeekRecs.length > 0 ? (calcOvertimePeriod(pastWeekRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
    const weekTotal = Math.round(pastWeekMin + liveNetMin)
    return { emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal, lastRecord, stateFromPriorDay }
  }), [workers, recordsAllByEmp, recordsTodayByEmp, weekByEmp, today, liveMs])

  const { onlineCount, breakCount, outCount, absentCount, totalMinToday } = useMemo(() => ({
    onlineCount:   statuses.filter(s => s.isIn).length,
    breakCount:    statuses.filter(s => s.isOnLunch || s.isOnCafe).length,
    outCount:      statuses.filter(s => !s.isIn && recordsTodayByEmp.has(s.emp.id)).length,
    absentCount:   statuses.filter(s => !recordsTodayByEmp.has(s.emp.id)).length,
    totalMinToday: statuses.reduce((sum, s) => sum + s.liveNetMin, 0),
  }), [statuses, recordsTodayByEmp])

  const filteredStatuses = useMemo(() => statuses.filter(s => {
    if (filter === 'working') return s.isWorking
    if (filter === 'break')   return s.isOnLunch || s.isOnCafe
    if (filter === 'out')     return !s.isIn && recordsTodayByEmp.has(s.emp.id)
    if (filter === 'absent')  return !recordsTodayByEmp.has(s.emp.id)
    return true
  }), [statuses, filter, recordsTodayByEmp])

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">
            {t('tab.status')}
            <span className="live-dot pulse" style={{ marginLeft: 10, display: 'inline-block', verticalAlign: 'middle' }} />
          </div>
          <div className="page-sub">{onlineCount} trabalhando · {breakCount} em pausa · atualizado agora</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Lista</button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>Cards</button>
          </div>
          <button className="btn" onClick={load}><IconRefresh size={13}/> Atualizar</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="kpi">
          <div className="kpi-label">{t('status.on_duty_now')}</div>
          <div className="kpi-value tnum" style={{ color: 'var(--success-fg)' }}>
            {onlineCount}<span style={{ fontSize: 14, color: 'var(--fg-subtle)', fontWeight: 500 }}> / {workers.length}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t('status.hours_today')}</div>
          <div className="kpi-value tnum">{totalMinToday > 0 ? fmtMinutes(Math.round(totalMinToday)) : '—'}</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="filter-bar">
        <FilterPill id="all"     label="Todos"        count={statuses.length}         active={filter === 'all'}     onClick={setFilter} />
        <FilterPill id="working" label="Trabalhando"  count={onlineCount - breakCount} active={filter === 'working'} onClick={setFilter} tone="success" />
        <FilterPill id="break"   label="Em pausa"     count={breakCount}               active={filter === 'break'}   onClick={setFilter} tone="warn" />
        <FilterPill id="out"     label="Encerraram"   count={outCount}                 active={filter === 'out'}     onClick={setFilter} />
        <FilterPill id="absent"  label="Sem registro" count={absentCount}              active={filter === 'absent'}  onClick={setFilter} />
      </div>

      {/* Exactly one view is rendered — ternary guarantees mutual exclusion. */}
      {view === 'grid' ? (
        workers.length === 0 ? null : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {filteredStatuses.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty">
                  <div className="title">{t('status.none_in_state')}</div>
                  <div className="desc">Ajuste o filtro acima.</div>
                </div>
              </div>
            ) : filteredStatuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, stateFromPriorDay, lastRecord }) => {
              const targetMin = emp.workday_hours * 60
              const pct = Math.min(100, targetMin > 0 ? (liveNetMin / targetMin) * 100 : 0)
              return (
                <div key={emp.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative' }}>
                        <div className={`avatar size-36 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                        <span style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 10, height: 10, borderRadius: '50%',
                          background: isWorking ? 'var(--success-fg)' : (isOnLunch || isOnCafe) ? 'var(--warning-fg)' : 'var(--fg-dim)',
                          border: '2px solid var(--surface)',
                        }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                          {emp.role === 'manager' ? t('auth.role.manager') : t('auth.role.employee')} · {emp.workday_hours}h/dia
                        </div>
                      </div>
                    </div>
                    <div>
                      {isWorking && <span className="chip success"><span className="dot"/>{t('status.on_duty')}</span>}
                      {isOnLunch && <span className="chip warn"><span className="dot"/>{t('status.at_lunch')}</span>}
                      {isOnCafe  && <span className="chip warn"><span className="dot"/>{t('status.coffee_break')}</span>}
                      {!isIn && recordsTodayByEmp.has(emp.id) && <span className="chip outline">{t('status.no_records')}</span>}
                      {!isIn && !recordsTodayByEmp.has(emp.id) && <span className="chip outline">—</span>}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--fg-muted)', marginBottom: 6 }}>
                        <span>Jornada</span>
                        <span className="tnum">{fmtMinutes(Math.round(liveNetMin))} / {emp.workday_hours}h</span>
                      </div>
                      <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                    </div>
                    {liveEarnings && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-muted)' }}>
                        <span>Ganhos hoje</span>
                        <span className="tnum" style={{ color: 'var(--success-fg)', fontWeight: 550 }}>{liveEarnings}</span>
                      </div>
                    )}
                    {msg?.id === emp.id && (
                      <div style={{ fontSize: 12, color: msg.kind === 'success' ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{msg.text}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
                    <button
                      onClick={() => handlePunch(emp, isIn ? 'saída' : 'entrada')}
                      disabled={punching === emp.id}
                      className={isIn ? 'btn danger sm' : 'btn primary sm'}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {punching === emp.id ? '…' : isIn ? t('status.clock_out') : t('status.clock_in')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="card">
          {workers.length === 0 && (
            <div style={{ padding: '16px 20px' }}><div className="alert-inline info">{t('status.none_emp')}</div></div>
          )}
          {filteredStatuses.length === 0 && workers.length > 0 && (
            <div className="empty"><div className="desc">{t('status.none_in_state')}</div></div>
          )}
          {filteredStatuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal, stateFromPriorDay, lastRecord }) => {
            const targetMin = emp.workday_hours * 60
            const pct = Math.min(100, targetMin > 0 ? (liveNetMin / targetMin) * 100 : 0)
            return (
              <div key={emp.id} className="status-row">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div className={`avatar size-28 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 8, height: 8, borderRadius: '50%',
                    background: isWorking ? 'var(--success-fg)' : (isOnLunch || isOnCafe) ? 'var(--warning-fg)' : 'var(--fg-dim)',
                    border: '2px solid var(--bg)',
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{emp.name}</div>
                  <div style={{ fontSize: 12, marginTop: 2, color: 'var(--fg-muted)' }}>
                    {isWorking
                      ? <span style={{ color: 'var(--success-fg)' }}>
                          {t('status.on_duty')} · {stateFromPriorDay && lastRecord
                            ? <span style={{ color: 'var(--warning-fg)' }}>desde {new Date(lastRecord.timestamp).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · sem saída</span>
                            : liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '< 1min'}
                        </span>
                      : isOnLunch ? <span style={{ color: 'var(--warning-fg)' }}>{t('status.at_lunch')}{stateFromPriorDay && ' (desde ontem)'}</span>
                      : isOnCafe  ? <span style={{ color: 'var(--warning-fg)' }}>{t('status.coffee_break')}{stateFromPriorDay && ' (desde ontem)'}</span>
                      : <span>{liveNetMin > 0 ? `${fmtMinutes(Math.round(liveNetMin))} ${t('common.today')}` : t('status.no_records')}</span>
                    }
                  </div>
                  {liveEarnings && <div style={{ fontSize: 11, color: 'var(--success-fg)', marginTop: 2, opacity: 0.75 }}>{liveEarnings} {t('common.today')}</div>}
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="tnum">{fmtMinutes(Math.round(liveNetMin))} / {emp.workday_hours}h hoje</span>
                    {weekTotal > 0 && <span>· <span className="tnum">{fmtMinutes(weekTotal)}</span> {t('status.this_week')}</span>}
                    {emp.hourly_rate != null && <span>· {Number(emp.hourly_rate).toFixed(2).replace('.', ',')} €/h</span>}
                  </div>
                  {msg?.id === emp.id && (
                    <div style={{ fontSize: 12, marginTop: 4, color: msg.kind === 'success' ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{msg.text}</div>
                  )}
                </div>
                <div data-col="bar" style={{ width: 80, flexShrink: 0 }}>
                  <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3, textAlign: 'right' }} className="tnum">
                    {fmtMinutes(Math.round(liveNetMin))} / {emp.workday_hours}h
                  </div>
                </div>
                <div data-col="chip" style={{ width: 90, flexShrink: 0 }}>
                  {isWorking    && <span className="chip success">Trabalhando</span>}
                  {isOnLunch    && <span className="chip warn">Almoço</span>}
                  {isOnCafe     && <span className="chip warn">Pausa</span>}
                  {!isIn && recordsTodayByEmp.has(emp.id) && <span className="chip outline">Saiu</span>}
                  {!isIn && !recordsTodayByEmp.has(emp.id) && <span className="chip outline">—</span>}
                </div>
                <button
                  onClick={() => handlePunch(emp, isIn ? 'saída' : 'entrada')}
                  disabled={punching === emp.id}
                  className={isIn ? 'btn danger sm' : 'btn primary sm'}
                >
                  {punching === emp.id ? '…' : isIn ? t('status.clock_out') : t('status.clock_in')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
