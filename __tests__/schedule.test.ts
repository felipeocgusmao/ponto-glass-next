import { describe, it, expect } from 'vitest'
import {
  dowOfDate,
  isScheduledWorkday,
  targetMinutesForDate,
  expectedStartForDate,
  expectedEndForDate,
  validateWeeklySchedule,
  calcDayPay,
  calcPeriodPay,
  longestContinuousWorkMin,
  restBetweenDaysMin,
  type WeeklySchedule,
} from '../lib/schedule'
import { calcOvertimePeriod } from '../lib/utils'
import type { PunchRecord } from '../lib/types'

// 2026-07-13 = Monday … 2026-07-18 = Saturday, 2026-07-19 = Sunday
const MON = '2026-07-13'
const SAT = '2026-07-18'
const SUN = '2026-07-19'

// SSCar-style schedule: 8h30 weekdays, 7h Saturday, Sunday off.
const SSCAR: WeeklySchedule = {
  '0': { off: true },
  '1': { hours: 8.5, start: '09:30', end: '19:30' },
  '2': { hours: 8.5, start: '09:30', end: '19:30' },
  '3': { hours: 8.5, start: '09:30', end: '19:30' },
  '4': { hours: 8.5, start: '09:30', end: '19:30' },
  '5': { hours: 8.5, start: '09:30', end: '19:30' },
  '6': { hours: 7, start: '09:30', end: '18:00' },
}

// Sunday worker: rests Saturday, works Sundays.
const SUNDAY_WORKER: WeeklySchedule = {
  '0': { hours: 8, start: '09:30' },
  '6': { off: true },
}

const rec = (type: PunchRecord['type'], timestamp: string): PunchRecord => ({
  id: '1', employee_id: 'e1', employee_name: 'Test', type, timestamp,
  date: timestamp.split('T')[0],
})

describe('dowOfDate', () => {
  it('maps business dates to weekday', () => {
    expect(dowOfDate(MON)).toBe(1)
    expect(dowOfDate(SAT)).toBe(6)
    expect(dowOfDate(SUN)).toBe(0)
  })
})

describe('isScheduledWorkday', () => {
  it('legacy employee (no schedule): Mon–Fri', () => {
    const emp = { workday_hours: 8 }
    expect(isScheduledWorkday(emp, MON)).toBe(true)
    expect(isScheduledWorkday(emp, SAT)).toBe(false)
    expect(isScheduledWorkday(emp, SUN)).toBe(false)
  })

  it('SSCar schedule: Saturday works, Sunday off', () => {
    const emp = { workday_hours: 8.5, weekly_schedule: SSCAR }
    expect(isScheduledWorkday(emp, SAT)).toBe(true)
    expect(isScheduledWorkday(emp, SUN)).toBe(false)
  })

  it('Sunday worker: missing weekdays default to working, Sunday explicit', () => {
    const emp = { workday_hours: 8, weekly_schedule: SUNDAY_WORKER }
    expect(isScheduledWorkday(emp, SUN)).toBe(true)
    expect(isScheduledWorkday(emp, SAT)).toBe(false)
    expect(isScheduledWorkday(emp, MON)).toBe(true)
  })
})

describe('targetMinutesForDate', () => {
  const emp = { workday_hours: 8.5, weekly_schedule: SSCAR }

  it('weekday uses the day hours', () => {
    expect(targetMinutesForDate(emp, MON)).toBe(510)
  })
  it('short Saturday counts 7h, not the weekday target', () => {
    expect(targetMinutesForDate(emp, SAT)).toBe(420)
  })
  it('day off targets 0 (all work that day is beyond target)', () => {
    expect(targetMinutesForDate(emp, SUN)).toBe(0)
  })
  it('no schedule → flat workday_hours for any day (legacy)', () => {
    expect(targetMinutesForDate({ workday_hours: 8 }, SAT)).toBe(480)
  })
  it('day entry without hours falls back to workday_hours', () => {
    const e = { workday_hours: 6, weekly_schedule: { '1': { start: '08:00' } } as WeeklySchedule }
    expect(targetMinutesForDate(e, MON)).toBe(360)
  })
})

describe('expectedStart/EndForDate', () => {
  it('per-day start/end override the single fields', () => {
    const emp = { workday_hours: 8.5, weekly_schedule: SSCAR, expected_start: '08:00', expected_end: '17:00' }
    expect(expectedStartForDate(emp, SAT)).toBe('09:30')
    expect(expectedEndForDate(emp, SAT)).toBe('18:00')
  })
  it('falls back to the single fields when the day has none', () => {
    const emp = { workday_hours: 8, weekly_schedule: SUNDAY_WORKER, expected_start: '09:00', expected_end: '18:30' }
    expect(expectedStartForDate(emp, MON)).toBe('09:00')
    expect(expectedEndForDate(emp, SUN)).toBe('18:30')
  })
  it('day off has no expected times', () => {
    const emp = { workday_hours: 8.5, weekly_schedule: SSCAR, expected_start: '09:30' }
    expect(expectedStartForDate(emp, SUN)).toBeNull()
    expect(expectedEndForDate(emp, SUN)).toBeNull()
  })
})

describe('validateWeeklySchedule', () => {
  it('accepts null and a valid schedule', () => {
    expect(validateWeeklySchedule(null)).toBeNull()
    expect(validateWeeklySchedule(SSCAR)).toBeNull()
  })
  it('rejects bad keys, hours and times', () => {
    expect(validateWeeklySchedule({ '7': {} })).toBeTruthy()
    expect(validateWeeklySchedule({ '1': { hours: 30 } })).toBeTruthy()
    expect(validateWeeklySchedule({ '1': { start: '25:00' } })).toBeTruthy()
    expect(validateWeeklySchedule([])).toBeTruthy()
  })
})

describe('calcOvertimePeriod with per-date target', () => {
  it('mixed week: 8h30 weekday + 7h Saturday exactly on target → 0 overtime', () => {
    const records = [
      // Monday: 09:30–19:30 with 1h30 lunch = 8h30
      rec('entrada',       `${MON}T09:30:00Z`),
      rec('inicio_almoco', `${MON}T12:30:00Z`),
      rec('fim_almoco',    `${MON}T14:00:00Z`),
      rec('saída',         `${MON}T19:30:00Z`),
      // Saturday: 09:30–18:00 with 1h30 lunch = 7h
      rec('entrada',       `${SAT}T09:30:00Z`),
      rec('inicio_almoco', `${SAT}T12:30:00Z`),
      rec('fim_almoco',    `${SAT}T14:00:00Z`),
      rec('saída',         `${SAT}T18:00:00Z`),
    ]
    const emp = { workday_hours: 8.5, weekly_schedule: SSCAR }
    expect(calcOvertimePeriod(records, d => targetMinutesForDate(emp, d), 0)).toBe(0)
    // The flat legacy target would misreport the same week as -1h30:
    expect(calcOvertimePeriod(records, 510, 0)).toBe(-90)
  })
})

describe('calcDayPay (art. 268.º CT uplifts)', () => {
  it('no context → flat rate', () => {
    expect(calcDayPay(480, 10)).toBe(80)
  })
  it('normal day within target → flat rate', () => {
    expect(calcDayPay(480, 10, { targetMin: 510, isRestDay: false, isHoliday: false })).toBe(80)
  })
  it('overtime: +25% first hour, +37.5% after', () => {
    // 10h on an 8h target: 8h flat + 1h ×1.25 + 1h ×1.375 = 80 + 12.5 + 13.75
    expect(calcDayPay(600, 10, { targetMin: 480, isRestDay: false, isHoliday: false })).toBeCloseTo(106.25)
  })
  it('rest day / holiday: +50% on every hour', () => {
    expect(calcDayPay(240, 10, { targetMin: 0, isRestDay: true, isHoliday: false })).toBeCloseTo(60)
    expect(calcDayPay(240, 10, { targetMin: 480, isRestDay: false, isHoliday: true })).toBeCloseTo(60)
  })
})

describe('calcPeriodPay', () => {
  const emp = { workday_hours: 8, hourly_rate: 10, weekly_schedule: SSCAR }
  const monday8h = [
    rec('entrada',       `${MON}T09:00:00Z`),
    rec('inicio_almoco', `${MON}T13:00:00Z`),
    rec('fim_almoco',    `${MON}T14:00:00Z`),
    rec('saída',         `${MON}T18:00:00Z`),
  ]

  it('multipliers off → flat, matches the old maths', () => {
    expect(calcPeriodPay(monday8h, emp, { multipliers: false })).toBeCloseTo(80)
  })
  it('sunday work pays ×1.5 when multipliers on', () => {
    const sunday4h = [
      rec('entrada', `${SUN}T09:00:00Z`),
      rec('saída',   `${SUN}T13:00:00Z`),
    ]
    expect(calcPeriodPay(sunday4h, emp, { multipliers: true })).toBeCloseTo(60)
  })
  it('holiday pays ×1.5 when multipliers on', () => {
    expect(calcPeriodPay(monday8h, emp, { multipliers: true, holidays: [MON] })).toBeCloseTo(120)
  })
  it('null rate → null', () => {
    expect(calcPeriodPay(monday8h, { workday_hours: 8, hourly_rate: null }, { multipliers: true })).toBeNull()
  })
})

describe('rest-compliance helpers (art. 213.º/214.º CT)', () => {
  it('longestContinuousWorkMin: lunch splits the stretch', () => {
    const day = [
      rec('entrada',       `${MON}T09:30:00Z`),
      rec('inicio_almoco', `${MON}T12:30:00Z`),
      rec('fim_almoco',    `${MON}T14:00:00Z`),
      rec('saída',         `${MON}T19:30:00Z`),
    ]
    expect(longestContinuousWorkMin(day)).toBe(330) // afternoon 14:00–19:30
  })
  it('longestContinuousWorkMin: no punch-out → open stretch not counted', () => {
    expect(longestContinuousWorkMin([rec('entrada', `${MON}T09:30:00Z`)])).toBe(0)
  })
  it('restBetweenDaysMin: computes the overnight gap', () => {
    const prev = [rec('entrada', `${MON}T09:30:00Z`), rec('saída', `${MON}T22:00:00Z`)]
    const next = [rec('entrada', '2026-07-14T08:00:00Z')]
    expect(restBetweenDaysMin(prev, next)).toBe(600) // 22:00 → 08:00 = 10h
  })
  it('restBetweenDaysMin: null when a side is missing', () => {
    expect(restBetweenDaysMin([rec('entrada', `${MON}T09:30:00Z`)], [rec('entrada', `${SUN}T08:00:00Z`)])).toBeNull()
  })
})
