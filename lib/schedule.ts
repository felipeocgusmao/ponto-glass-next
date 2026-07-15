// Weekly schedule per employee (#287) — different hours per weekday, days off,
// and weekend/holiday workers. Pure helpers shared by server (crons, hour bank)
// and client (dashboards, reports), so everything agrees on "what does this
// person's day look like".
//
// Storage: employees.weekly_schedule JSONB, keys '0'(Sunday)…'6'(Saturday).
// null/absent → the employee has NO custom weekly schedule and the legacy
// single-value fields (workday_hours, expected_start, expected_end) apply,
// with the legacy assumption of a Monday–Friday week.

import type { PunchRecord } from './types'
import { calcDayRounded } from './utils'

export interface DaySchedule {
  off?: boolean
  /** Target hours for this weekday (e.g. 8.5). null/absent → employee's workday_hours. */
  hours?: number | null
  /** Expected clock-in HH:MM. null/absent → employee's expected_start. */
  start?: string | null
  /** Expected clock-out HH:MM. null/absent → employee's expected_end. */
  end?: string | null
}

export type WeeklySchedule = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DaySchedule>>

/** The subset of employee fields the schedule helpers need. */
export interface ScheduledEmployee {
  workday_hours: number
  weekly_schedule?: WeeklySchedule | null
  expected_start?: string | null
  expected_end?: string | null
  works_holidays?: boolean
}

/** Day of week (0=Sunday…6=Saturday) of a business-date string 'YYYY-MM-DD'. */
export function dowOfDate(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function dayEntry(emp: ScheduledEmployee, date: string): DaySchedule | null {
  const ws = emp.weekly_schedule
  if (!ws || typeof ws !== 'object') return null
  const entry = ws[String(dowOfDate(date)) as keyof WeeklySchedule]
  return entry && typeof entry === 'object' ? entry : null
}

/**
 * Is this a scheduled working day for the employee?
 * - With a weekly schedule: the day's `off` flag decides; a weekday missing
 *   from the schedule defaults to working, a missing weekend day to off.
 * - Without one: legacy behaviour — Monday–Friday.
 */
export function isScheduledWorkday(emp: ScheduledEmployee, date: string): boolean {
  const dow = dowOfDate(date)
  const weekend = dow === 0 || dow === 6
  const entry = dayEntry(emp, date)
  if (entry) return !entry.off
  if (emp.weekly_schedule && typeof emp.weekly_schedule === 'object') return !weekend
  return !weekend
}

/**
 * Target worked minutes for a date. Used by hour bank / overtime so a 7h
 * Saturday doesn't read as −1h30 against an 8h30 weekday target.
 * NOTE: days off return 0 — any work done on them is all beyond target.
 */
export function targetMinutesForDate(emp: ScheduledEmployee, date: string): number {
  const entry = dayEntry(emp, date)
  if (entry) {
    if (entry.off) return 0
    if (entry.hours != null && !Number.isNaN(Number(entry.hours))) return Math.round(Number(entry.hours) * 60)
    return Math.round(emp.workday_hours * 60)
  }
  // No schedule (or day missing from it): keep the legacy behaviour where the
  // single workday target applies to any day that has records.
  return Math.round(emp.workday_hours * 60)
}

/** Expected clock-in for a date (schedule day → employee default → null). */
export function expectedStartForDate(emp: ScheduledEmployee, date: string): string | null {
  const entry = dayEntry(emp, date)
  if (entry?.off) return null
  if (entry?.start) return entry.start
  return emp.expected_start ?? null
}

/** Expected clock-out for a date (schedule day → employee default → null). */
export function expectedEndForDate(emp: ScheduledEmployee, date: string): string | null {
  const entry = dayEntry(emp, date)
  if (entry?.off) return null
  if (entry?.end) return entry.end
  return emp.expected_end ?? null
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validate a client-supplied weekly_schedule payload. Returns an error message
 * (pt) or null when valid. `null` as the whole value is valid (= no schedule).
 */
export function validateWeeklySchedule(ws: unknown): string | null {
  if (ws === null) return null
  if (typeof ws !== 'object' || Array.isArray(ws)) return 'Horário semanal inválido'
  for (const [key, value] of Object.entries(ws as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(key)) return 'Dia da semana inválido no horário (use 0–6)'
    if (value === null || value === undefined) continue
    if (typeof value !== 'object' || Array.isArray(value)) return 'Entrada de dia inválida no horário semanal'
    const d = value as DaySchedule
    if (d.off !== undefined && typeof d.off !== 'boolean') return 'Campo "off" deve ser booleano'
    if (d.hours !== undefined && d.hours !== null) {
      const h = Number(d.hours)
      if (Number.isNaN(h) || h < 0 || h > 24) return 'Horas do dia devem estar entre 0 e 24'
    }
    if (d.start !== undefined && d.start !== null && !TIME_RE.test(String(d.start))) return 'Hora de entrada inválida no horário semanal'
    if (d.end !== undefined && d.end !== null && !TIME_RE.test(String(d.end))) return 'Hora de saída inválida no horário semanal'
  }
  return null
}

// ─── Portuguese labour-law pay uplifts (#285, art. 268.º CT) ───────────────────
// Opt-in per company (tenants.alert_settings.overtime_multipliers). Overtime on
// a normal day pays +25% for the first hour and +37.5% after; work on the
// employee's rest day or a public holiday pays +50% on every hour.

export interface DayPayContext {
  /** Target minutes for the day (0 = rest day). */
  targetMin: number
  /** The employee does not work this weekday (schedule off / legacy weekend). */
  isRestDay: boolean
  /** Company-wide holiday (day_exceptions type 'holiday', employee_id null). */
  isHoliday: boolean
}

/** Earnings in € for one day's net minutes, applying legal uplifts when ctx given. */
export function calcDayPay(netMin: number, hourlyRate: number, ctx?: DayPayContext | null): number {
  if (netMin <= 0) return 0
  if (!ctx) return (netMin / 60) * hourlyRate
  if (ctx.isHoliday || ctx.isRestDay) return (netMin / 60) * hourlyRate * 1.5
  const normal = Math.min(netMin, ctx.targetMin)
  const extra = Math.max(0, netMin - ctx.targetMin)
  const firstHour = Math.min(extra, 60)
  const beyond = extra - firstHour
  const weighted = normal + firstHour * 1.25 + beyond * 1.375
  return (weighted / 60) * hourlyRate
}

export interface PeriodPayOptions {
  /** Apply the legal uplifts (tenant opt-in). false → flat rate, same as before. */
  multipliers: boolean
  /** Company-holiday dates 'YYYY-MM-DD' inside the period. */
  holidays?: Set<string> | string[]
  lunchBreakMinutes?: number
}

/**
 * Period earnings for an employee: per-day rounded net minutes × rate, with the
 * optional legal uplifts. Mirrors the day rounding used in reports/holerites so
 * the money matches the printed hours.
 */
export function calcPeriodPay(
  records: PunchRecord[],
  emp: ScheduledEmployee & { hourly_rate: number | null },
  opts: PeriodPayOptions,
): number | null {
  if (emp.hourly_rate == null) return null
  const holidaySet = opts.holidays instanceof Set ? opts.holidays : new Set(opts.holidays ?? [])
  const lunch = opts.lunchBreakMinutes ?? 0
  const byDay = new Map<string, PunchRecord[]>()
  records.forEach(r => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })
  let total = 0
  byDay.forEach((dayRecs, date) => {
    const netMin = calcDayRounded(dayRecs, lunch)
    if (netMin <= 0) return
    const ctx: DayPayContext | null = opts.multipliers
      ? {
          targetMin: targetMinutesForDate(emp, date),
          isRestDay: !isScheduledWorkday(emp, date),
          isHoliday: holidaySet.has(date),
        }
      : null
    total += calcDayPay(netMin, Number(emp.hourly_rate), ctx)
  })
  return total
}

// ─── Rest-compliance checks (#285, art. 213.º/214.º CT) ────────────────────────

/**
 * Longest stretch of continuous working minutes in one day's punches (coffee
 * and lunch breaks interrupt the stretch). Used for the >5h-consecutive alert.
 */
export function longestContinuousWorkMin(records: PunchRecord[]): number {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  let working = false
  let stretchStart = 0
  let longest = 0
  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime()
    const startsWork = r.type === 'entrada' || r.type === 'fim_almoco' || r.type === 'retorno_cafe'
    if (startsWork) {
      if (!working) { working = true; stretchStart = t }
    } else if (working) {
      longest = Math.max(longest, t - stretchStart)
      working = false
    }
  }
  return Math.round(longest / 60_000)
}

/**
 * Minutes of rest between the last 'saída' of one day and the first 'entrada'
 * of the next. null when either side is missing (nothing to compare).
 */
export function restBetweenDaysMin(prevDay: PunchRecord[], nextDay: PunchRecord[]): number | null {
  const exits = prevDay.filter(r => r.type === 'saída')
    .map(r => new Date(r.timestamp).getTime())
  const entries = nextDay.filter(r => r.type === 'entrada')
    .map(r => new Date(r.timestamp).getTime())
  if (!exits.length || !entries.length) return null
  const lastExit = Math.max(...exits)
  const firstEntry = Math.min(...entries)
  if (firstEntry <= lastExit) return null
  return Math.round((firstEntry - lastExit) / 60_000)
}
