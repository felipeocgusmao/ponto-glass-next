import { memo } from 'react'
import type { EmployeeProfile, PunchRecord, DayException } from '@/lib/types'
import { calcNetMinutes, fmtCentesimal, roundToQuarter, openPayslip, businessDate } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'
import { CalendarView } from './CalendarView'

const PUNCH_LABEL_PT: Record<string, string> = {
  entrada: 'Entrada', 'saída': 'Saída',
  inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
  pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
}
const PUNCH_TONE: Record<string, string> = {
  entrada: 'success', fim_almoco: 'success', retorno_cafe: 'success',
  'saída': 'danger', inicio_almoco: 'warn', pausa_cafe: 'warn',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  user: EmployeeProfile
  historyLoading: boolean
  historyLoaded: boolean
  historyRecs: PunchRecord[]
  historyExceptionsFull: DayException[]
  byDay: Map<string, PunchRecord[]>
  sortedDays: string[]
  totalMonthMin: number
  absentDays: string[]
  histYM: { year: number; month: number }
  histMonthLabel: string
  isCurrentHistMonth: boolean
  calendarView: boolean
  setCalendarView: (v: boolean) => void
  goPrevMonth: () => void
  goNextMonth: () => void
}

export const HistoricoTab = memo(function HistoricoTab({
  user, historyLoading, historyRecs, historyExceptionsFull,
  byDay, sortedDays, totalMonthMin, absentDays,
  histYM, histMonthLabel, isCurrentHistMonth,
  calendarView, setCalendarView, goPrevMonth, goNextMonth,
}: Props) {
  const { t } = useLang()
  const today = businessDate()

  return (
    <div className="emp-card">
      {/* Weekly bar chart — only shown when viewing the current month */}
      {isCurrentHistMonth && !historyLoading && byDay.size > 0 && (() => {
        const targetMin = (user?.workday_hours ?? 8) * 60
        const days7: { date: string; min: number; isToday: boolean; isWeekend: boolean }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today + 'T12:00:00')
          d.setDate(d.getDate() - i)
          const iso = d.toISOString().split('T')[0]
          const recs = byDay.get(iso) ?? []
          const dow = d.getDay()
          days7.push({
            date: iso,
            min: recs.length > 0 ? roundToQuarter(calcNetMinutes(recs, user.lunch_break_minutes)) : 0,
            isToday: iso === today,
            isWeekend: dow === 0 || dow === 6,
          })
        }
        const maxMin = Math.max(targetMin * 1.2, ...days7.map(d => d.min))
        const W = 44, GAP = 6, H = 52, LABEL_H = 18
        const totalW = days7.length * W + (days7.length - 1) * GAP
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 8 }}>{t('emp.last_7_days')}</div>
            <svg width="100%" viewBox={`0 0 ${totalW} ${H + LABEL_H}`} style={{ overflow: 'visible', display: 'block' }}>
              <line
                x1={0} y1={H - (targetMin / maxMin) * H}
                x2={totalW} y2={H - (targetMin / maxMin) * H}
                stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
              />
              {days7.map((d, i) => {
                const barH = d.min > 0 ? Math.max(3, (d.min / maxMin) * H) : 0
                const x = i * (W + GAP)
                const [, mo, day] = d.date.split('-').map(Number)
                const fill = d.isToday ? 'var(--accent)' : d.isWeekend ? 'var(--surface-3)' : 'var(--surface-2)'
                const textColor = d.isToday ? 'var(--accent)' : 'var(--fg-subtle)'
                return (
                  <g key={d.date}>
                    <rect
                      x={x} y={H - barH} width={W} height={barH}
                      rx={4} fill={fill} opacity={d.isWeekend && !d.min ? 0.4 : 1}
                    />
                    {d.min > 0 && (
                      <text x={x + W / 2} y={H - barH - 3} textAnchor="middle" fontSize={8} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
                        {Math.floor(d.min / 60)}h{d.min % 60 > 0 ? String(d.min % 60).padStart(2,'0') : ''}
                      </text>
                    )}
                    <text x={x + W / 2} y={H + 12} textAnchor="middle" fontSize={9} fill={textColor} fontWeight={d.isToday ? 700 : 400}>
                      {String(day).padStart(2,'0')}/{String(mo).padStart(2,'0')}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })()}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={goPrevMonth} aria-label={t('emp.prev_month')}
              style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: '2px 9px', borderRadius: 4, fontSize: 13, color: 'var(--fg-muted)' }}>‹</button>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', minWidth: 104, textAlign: 'center' }}>
              {histMonthLabel}
            </div>
            <button onClick={goNextMonth} disabled={isCurrentHistMonth} aria-label={t('emp.next_month')}
              style={{ background: 'var(--surface-2)', border: 'none', cursor: isCurrentHistMonth ? 'default' : 'pointer', padding: '2px 9px', borderRadius: 4, fontSize: 13, color: 'var(--fg-muted)', opacity: isCurrentHistMonth ? 0.4 : 1 }}>›</button>
          </div>
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 6, padding: '2px 3px', gap: 1 }}>
            <button
              onClick={() => setCalendarView(false)}
              style={{ background: !calendarView ? 'var(--accent)' : 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: !calendarView ? '#fff' : 'var(--fg-muted)', transition: 'all 0.15s' }}
            >{t('calendar.list_view')}</button>
            <button
              onClick={() => setCalendarView(true)}
              style={{ background: calendarView ? 'var(--accent)' : 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: calendarView ? '#fff' : 'var(--fg-muted)', transition: 'all 0.15s' }}
            >{t('calendar.calendar_view')}</button>
          </div>
        </div>
        {!calendarView && totalMonthMin > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--fg)' }} title={`${Math.floor(totalMonthMin/60)}h${totalMonthMin%60}min`}>{fmtCentesimal(totalMonthMin)}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('history.worked_month')}</span>
          </div>
        )}
      </div>

      {historyLoading && <div className="alert-inline info">{t('common.loading')}</div>}

      {calendarView && !historyLoading && (
        <CalendarView
          records={historyRecs}
          exceptions={historyExceptionsFull}
          year={histYM.year}
          month={histYM.month}
          lunchBreakMinutes={user.lunch_break_minutes}
        />
      )}

      {!calendarView && (
        <>
          {!historyLoading && sortedDays.length === 0 && (
            <div className="alert-inline info">{t('history.no_records')}</div>
          )}

          {!historyLoading && historyRecs.length > 0 && (
            <button
              className="btn-emp"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
              onClick={() => openPayslip(user.name, histMonthLabel, historyRecs, user.workday_hours, user.lunch_break_minutes, user.hourly_rate)}
            >
              {t('history.export_payslip')}
            </button>
          )}

          {[
            ...sortedDays.map(date => ({ date, type: 'day' as const })),
            ...absentDays.map(date => ({ date, type: 'absent' as const })),
          ].sort((a, b) => b.date.localeCompare(a.date)).map(({ date, type }) => {
            if (type === 'absent') {
              const dt = new Date(date + 'T12:00:00')
              return (
                <div key={`absent-${date}`} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>
                    {dt.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                  <span className="chip danger" style={{ fontSize: 10 }}>{t('ponto.absent_day')}</span>
                </div>
              )
            }
            const recs = byDay.get(date)!.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            const exactDayMin = calcNetMinutes(recs, user.lunch_break_minutes)
            const dayMin = roundToQuarter(exactDayMin)
            const dt = new Date(date + 'T12:00:00')
            const isToday = date === today
            return (
              <div key={date} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--fg)', textTransform: 'capitalize' }}>
                      {dt.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    {isToday && <span className="chip accent" style={{ fontSize: 9, marginLeft: 6 }}>{t('emp.today_chip')}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: dayMin > 0 ? 'var(--fg)' : 'var(--fg-subtle)' }}>
                    {dayMin > 0 ? fmtCentesimal(dayMin) : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recs.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className={`chip ${PUNCH_TONE[r.type] ?? ''} outline`} style={{ fontSize: 10 }}>
                        {t(`punch.${r.type}` as Parameters<typeof t>[0]) || PUNCH_LABEL_PT[r.type] || r.type}
                      </span>
                      <span className="muted tnum" style={{ fontSize: 10 }}>{fmtTime(r.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
})
