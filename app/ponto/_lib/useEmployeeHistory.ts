'use client'

import { useCallback, useMemo, useState } from 'react'
import type { PunchRecord, DayException } from '@/lib/types'
import { calcNetMinutes, roundToQuarter, businessDate } from '@/lib/utils'

interface Options {
  lunchBreakMin: number
}

export function useEmployeeHistory({ lunchBreakMin }: Options) {
  const [historyRecs, setHistoryRecs] = useState<PunchRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyExceptions, setHistoryExceptions] = useState<string[]>([])
  const [historyExceptionsFull, setHistoryExceptionsFull] = useState<DayException[]>([])
  const [calendarView, setCalendarView] = useState(false)
  const [histYM, setHistYM] = useState(() => {
    const today = businessDate()
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }
  })

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const pad = (n: number) => String(n).padStart(2, '0')
      const { year, month } = histYM
      const from = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      const today = businessDate()
      const to = monthEnd > today ? today : monthEnd
      const [res, excRes] = await Promise.all([
        fetch(`/api/reports?from=${from}&to=${to}`),
        fetch(`/api/day-exceptions?from=${from}&to=${to}`),
      ])
      if (res.ok) {
        setHistoryRecs((await res.json()).data)
        if (excRes.ok) {
          const exc: DayException[] = await excRes.json()
          setHistoryExceptions(exc.map(e => e.date))
          setHistoryExceptionsFull(exc)
        }
        setHistoryLoaded(true)
      }
    } catch { /* keep */ }
    finally { setHistoryLoading(false) }
  }, [histYM])

  const { byDay, sortedDays, totalMonthMin, absentDays } = useMemo(() => {
    const byDay = new Map<string, PunchRecord[]>()
    historyRecs.forEach(r => {
      if (!byDay.has(r.date)) byDay.set(r.date, [])
      byDay.get(r.date)!.push(r)
    })
    const sortedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a))
    const totalMonthMin = sortedDays.reduce((sum, date) => {
      const recs = byDay.get(date)!
      const exact = calcNetMinutes(recs, lunchBreakMin)
      return sum + roundToQuarter(exact)
    }, 0)
    const absentDays: string[] = (() => {
      if (!historyLoaded || (historyRecs.length === 0 && sortedDays.length === 0)) return []
      const pad = (n: number) => String(n).padStart(2, '0')
      const { year, month } = histYM
      const firstOfMonth = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      const today = businessDate()
      const cur = new Date(firstOfMonth + 'T12:00:00')
      const end = new Date((monthEnd > today ? today : monthEnd) + 'T12:00:00')
      const absent: string[] = []
      while (cur <= end) {
        const d = cur.getDay()
        const iso = cur.toISOString().split('T')[0]
        if (d !== 0 && d !== 6 && !byDay.has(iso) && !historyExceptions.includes(iso)) absent.push(iso)
        cur.setDate(cur.getDate() + 1)
      }
      return absent
    })()
    return { byDay, sortedDays, totalMonthMin, absentDays }
  }, [historyRecs, histYM, historyLoaded, historyExceptions, lunchBreakMin])

  const todayBiz = businessDate()
  const isCurrentHistMonth = histYM.year === Number(todayBiz.slice(0, 4)) && histYM.month === Number(todayBiz.slice(5, 7)) - 1
  const histMonthLabel = new Date(histYM.year, histYM.month, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const goPrevMonth = useCallback(() => setHistYM(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }), [])
  const goNextMonth = useCallback(() => setHistYM(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }), [])

  const invalidateHistory = useCallback(() => setHistoryLoaded(false), [])

  return {
    historyRecs, historyLoading, historyLoaded,
    historyExceptionsFull,
    byDay, sortedDays, totalMonthMin, absentDays,
    histYM, histMonthLabel, isCurrentHistMonth,
    calendarView, setCalendarView,
    goPrevMonth, goNextMonth,
    loadHistory, invalidateHistory,
  }
}
