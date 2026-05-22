'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { avatarInitials, fmtMinutes, calcNetMinutes, calcTimeBreakdown, calcOvertimePeriod, WORKING_TYPES } from '@/lib/utils'
import { empColor, SL } from '../../_lib/helpers'
import { EXPLICIT_BREAK_TYPES } from '../../_lib/types'
import { useLang } from '@/lib/LangContext'

export function StatusTab({ employees, currentUserId }: { employees: Employee[]; currentUserId: string }) {
  const { t } = useLang()
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [liveMs, setLiveMs] = useState(() => Date.now())
  const [punching, setPunching] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; kind: 'success' | 'error'; text: string } | null>(null)
  const [weekRecords, setWeekRecords] = useState<PunchRecord[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/records?today=true')
      if (res.ok) setRecords(await res.json())
    } catch { /* keep current */ }
  }, [])

  const loadWeek = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const day = now.getDay()
    const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (fmt(yesterday) < fmt(monday)) return
    try {
      const res = await fetch(`/api/reports?from=${fmt(monday)}&to=${fmt(yesterday)}`)
      if (res.ok) setWeekRecords(await res.json())
    } catch { /* keep current */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadWeek() }, [loadWeek])
  useEffect(() => { const iv = setInterval(() => setLiveMs(Date.now()), 30_000); return () => clearInterval(iv) }, [])
  useEffect(() => { const iv = setInterval(load, 60_000); return () => clearInterval(iv) }, [load])

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

  const recordsByEmp = new Map<string, PunchRecord[]>()
  records.forEach(r => {
    if (!recordsByEmp.has(r.employee_id)) recordsByEmp.set(r.employee_id, [])
    recordsByEmp.get(r.employee_id)!.push(r)
  })
  const weekByEmp = new Map<string, PunchRecord[]>()
  weekRecords.forEach(r => {
    if (!weekByEmp.has(r.employee_id)) weekByEmp.set(r.employee_id, [])
    weekByEmp.get(r.employee_id)!.push(r)
  })

  const workers = employees.filter(e => e.id !== currentUserId)
  const statuses = workers.map(emp => {
    const empRecords = recordsByEmp.get(emp.id) ?? []
    const sortedAsc = [...empRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastType = sortedAsc.at(-1)?.type
    const isWorking = lastType != null && WORKING_TYPES.includes(lastType)
    const isOnLunch = lastType === 'inicio_almoco'
    const isOnCafe  = lastType === 'pausa_cafe'
    const isIn = isWorking || isOnLunch || isOnCafe
    const hasBreaks = empRecords.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
    let liveNetMin = 0
    if (hasBreaks) {
      const bd = calcTimeBreakdown(empRecords)
      const lastWorkStart = isWorking ? sortedAsc.slice().reverse().find(r => WORKING_TYPES.includes(r.type)) : undefined
      const ongoingMin = lastWorkStart ? (liveMs - new Date(lastWorkStart.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, bd.workedMin + ongoingMin)
    } else {
      const lastEntry = isWorking ? sortedAsc.slice().reverse().find(r => r.type === 'entrada') : undefined
      const currentSessionMin = lastEntry ? (liveMs - new Date(lastEntry.timestamp).getTime()) / 60_000 : 0
      liveNetMin = Math.max(0, calcNetMinutes(empRecords, 0) + currentSessionMin - emp.lunch_break_minutes)
    }
    const liveEarnings = emp.hourly_rate && liveNetMin > 0
      ? ((liveNetMin / 60) * emp.hourly_rate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
      : null
    const pastWeekRecs = weekByEmp.get(emp.id) ?? []
    const pastWeekMin = pastWeekRecs.length > 0 ? (calcOvertimePeriod(pastWeekRecs, 0, emp.lunch_break_minutes) ?? 0) : 0
    const weekTotal = Math.round(pastWeekMin + liveNetMin)
    return { emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal }
  })

  const onlineCount   = statuses.filter(s => s.isIn).length
  const totalMinToday = statuses.reduce((sum, s) => sum + s.liveNetMin, 0)

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="kpi">
            <div className="kpi-label">{t('status.on_duty_now')}</div>
            <div className="kpi-value" style={{ color: 'var(--success-fg)' }}>{onlineCount}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">{t('status.hours_today')}</div>
            <div className="kpi-value">{totalMinToday > 0 ? fmtMinutes(Math.round(totalMinToday)) : '—'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px 8px' }}>
          <SL>{workers.length} {t('status.employees')}</SL>
        </div>
        {workers.length === 0 && (
          <div style={{ padding: '0 20px 16px' }}><div className="alert-inline info">{t('status.none_emp')}</div></div>
        )}
        {statuses.map(({ emp, isWorking, isOnLunch, isOnCafe, isIn, liveNetMin, liveEarnings, weekTotal }) => (
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
                  ? <span style={{ color: 'var(--success-fg)' }}>{t('status.on_duty')} · {liveNetMin > 0 ? fmtMinutes(Math.round(liveNetMin)) : '< 1min'}</span>
                  : isOnLunch
                  ? <span style={{ color: 'var(--warning-fg)' }}>{t('status.at_lunch')}</span>
                  : isOnCafe
                  ? <span style={{ color: 'var(--warning-fg)' }}>{t('status.coffee_break')}</span>
                  : <span>{liveNetMin > 0 ? `${fmtMinutes(Math.round(liveNetMin))} ${t('common.today')}` : t('status.no_records')}</span>
                }
              </div>
              {liveEarnings && <div style={{ fontSize: 11, color: 'var(--success-fg)', marginTop: 2, opacity: 0.75 }}>{liveEarnings} {t('common.today')}</div>}
              {weekTotal > 0 && <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>{fmtMinutes(weekTotal)} {t('status.this_week')}</div>}
              {msg?.id === emp.id && (
                <div style={{ fontSize: 12, marginTop: 4, color: msg.kind === 'success' ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{msg.text}</div>
              )}
            </div>
            <button
              onClick={() => handlePunch(emp, isIn ? 'saída' : 'entrada')}
              disabled={punching === emp.id}
              className={isIn ? 'btn danger sm' : 'btn primary sm'}
            >
              {punching === emp.id ? '…' : isIn ? t('status.clock_out') : t('status.clock_in')}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
