'use client'

import type { PunchRecord, DayException } from '@/lib/types'
import { calcNetMinutes, calcTimeBreakdown, businessDate } from '@/lib/utils'

interface CalendarViewProps {
  records: PunchRecord[]
  exceptions: DayException[]
  year: number
  month: number  // 0-indexed
  lunchBreakMinutes: number
  onDayClick?: (date: string) => void
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}` : `${m}m`
}

export function CalendarView({ records, exceptions, year, month, lunchBreakMinutes, onDayClick }: CalendarViewProps) {
  const today = businessDate()
  const exceptionDates = new Set(exceptions.map(e => e.date))
  const exceptionMap = new Map(exceptions.map(e => [e.date, e]))

  const byDate = new Map<string, PunchRecord[]>()
  records.forEach(r => {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  })

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7  // Mon=0

  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1, background: 'var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden',
      }}>
        {weekDays.map(d => (
          <div key={d} style={{
            background: 'var(--surface-2)', padding: '5px 0', textAlign: 'center',
            fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} style={{ background: 'var(--bg)', minHeight: 52 }} />
          }

          const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const dow = (i % 7)  // Mon=0 ... Sun=6
          const isWeekend = dow >= 5
          const isFuture  = iso > today
          const isToday   = iso === today
          const isException = exceptionDates.has(iso)
          const exc = exceptionMap.get(iso)
          const dayRecs = byDate.get(iso) ?? []

          const hasBreaks = dayRecs.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
          const workedMin = dayRecs.length > 0
            ? (hasBreaks ? calcTimeBreakdown(dayRecs).workedMin : calcNetMinutes(dayRecs, lunchBreakMinutes))
            : 0
          const hasEntry = dayRecs.some(r => r.type === 'entrada')

          let bg = 'var(--bg)'
          let textColor = 'var(--fg)'
          let subColor = 'var(--fg-subtle)'
          let label = ''

          if (isException) {
            bg = 'color-mix(in oklch, var(--accent) 12%, var(--bg))'
            textColor = 'var(--accent)'
            label = exc?.type === 'holiday' ? 'Feriado' : 'Folga'
          } else if (isWeekend) {
            bg = 'var(--surface)'
            textColor = 'var(--fg-dim)'
          } else if (isFuture) {
            bg = 'var(--bg)'
            textColor = 'var(--fg-dim)'
          } else if (workedMin > 0) {
            bg = 'color-mix(in oklch, var(--success-fg) 10%, var(--bg))'
            textColor = 'var(--success-fg)'
            label = fmtMin(workedMin)
          } else if (!hasEntry && !isFuture && !isWeekend) {
            bg = 'color-mix(in oklch, var(--danger-fg) 8%, var(--bg))'
            textColor = 'var(--danger-fg)'
            subColor = 'var(--danger-fg)'
            label = '—'
          }

          return (
            <div
              key={iso}
              onClick={() => onDayClick?.(iso)}
              style={{
                background: bg,
                minHeight: 52, padding: '6px 5px',
                cursor: onDayClick ? 'pointer' : 'default',
                position: 'relative',
                outline: isToday ? `2px solid var(--accent)` : 'none',
                outlineOffset: '-2px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: textColor }}>{day}</div>
              {label && (
                <div style={{ fontSize: 9, color: subColor, marginTop: 2, fontWeight: 500 }}>{label}</div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--success-fg)', label: 'Trabalhado' },
          { color: 'var(--danger-fg)',  label: 'Ausente' },
          { color: 'var(--accent)',     label: 'Feriado/Folga' },
          { color: 'var(--fg-dim)',     label: 'Fim de semana' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--fg-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: `color-mix(in oklch, ${color} 30%, var(--bg))`, border: `1px solid ${color}`, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
