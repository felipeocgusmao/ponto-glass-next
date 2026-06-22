import { describe, it, expect } from 'vitest'
import {
  calcWorkDate,
  businessDate,
  calcNetMinutes,
  calcTimeBreakdown,
  haversineMeters,
  fmtMinutes,
  isIncompleteDay,
  avatarInitials,
} from '../lib/utils'
import type { PunchRecord } from '../lib/types'

const rec = (type: PunchRecord['type'], timestamp: string): PunchRecord => ({
  id: '1', employee_id: 'e1', employee_name: 'Test', type, timestamp,
  date: timestamp.split('T')[0],
})

describe('calcWorkDate', () => {
  it('normal shift: same day', () => {
    const date = calcWorkDate(new Date('2026-05-28T10:00:00Z'), '00:00')
    expect(date).toBe('2026-05-28')
  })

  it('night shift 22:00: punch at 23:00 → same day', () => {
    // 23:00 UTC in Europe/Madrid (UTC+2 summer) = 01:00 next day local
    // 23:00 local >= 22:00 shift start → same local day
    process.env.NEXT_PUBLIC_BUSINESS_TZ = 'UTC'
    const date = calcWorkDate(new Date('2026-05-28T23:00:00Z'), '22:00')
    expect(date).toBe('2026-05-28')
  })

  it('night shift 22:00: punch at 02:00 → previous day', () => {
    process.env.NEXT_PUBLIC_BUSINESS_TZ = 'UTC'
    const date = calcWorkDate(new Date('2026-05-29T02:00:00Z'), '22:00')
    expect(date).toBe('2026-05-28')
  })
})

describe('calcNetMinutes', () => {
  it('simple 8h day with paired entrada/saída', () => {
    const records = [
      rec('entrada', '2026-05-28T08:00:00Z'),
      rec('saída',   '2026-05-28T17:00:00Z'),
    ]
    expect(calcNetMinutes(records, 60)).toBe(480)
  })

  it('zero with no records', () => {
    expect(calcNetMinutes([], 60)).toBe(0)
  })

  it('explicit breaks: uses state machine', () => {
    const records = [
      rec('entrada',       '2026-05-28T08:00:00Z'),
      rec('inicio_almoco', '2026-05-28T13:00:00Z'),
      rec('fim_almoco',    '2026-05-28T14:00:00Z'),
      rec('saída',         '2026-05-28T17:00:00Z'),
    ]
    // 5h before lunch + 1h lunch + 3h after = 9h = 540min (break counts as worked)
    expect(calcNetMinutes(records, 60)).toBe(540)
  })
})

describe('calcTimeBreakdown', () => {
  it('counts lunch and coffee separately', () => {
    const records = [
      rec('entrada',       '2026-05-28T08:00:00Z'),
      rec('pausa_cafe',    '2026-05-28T10:00:00Z'),
      rec('retorno_cafe',  '2026-05-28T10:15:00Z'),
      rec('inicio_almoco', '2026-05-28T13:00:00Z'),
      rec('fim_almoco',    '2026-05-28T14:00:00Z'),
      rec('saída',         '2026-05-28T17:00:00Z'),
    ]
    const { workedMin, lunchMin, coffeeMin } = calcTimeBreakdown(records)
    expect(lunchMin).toBe(60)
    expect(coffeeMin).toBe(15)
    // 08-10 = 120min, 10:15-13 = 165min, 14-17 = 180min → 465min total
    expect(workedMin).toBe(465)
  })
})

describe('isIncompleteDay', () => {
  it('entrada without saída = incomplete', () => {
    expect(isIncompleteDay([rec('entrada', '2026-05-28T08:00:00Z')])).toBe(true)
  })
  it('both entrada and saída = complete', () => {
    expect(isIncompleteDay([
      rec('entrada', '2026-05-28T08:00:00Z'),
      rec('saída', '2026-05-28T17:00:00Z'),
    ])).toBe(false)
  })
  it('no records = not incomplete', () => {
    expect(isIncompleteDay([])).toBe(false)
  })
})

describe('haversineMeters', () => {
  it('same point = 0m', () => {
    expect(haversineMeters(40.4, -3.7, 40.4, -3.7)).toBe(0)
  })
  it('Madrid to Barcelona ≈ 504km', () => {
    const dist = haversineMeters(40.4168, -3.7038, 41.3851, 2.1734)
    expect(dist).toBeGreaterThan(500_000)
    expect(dist).toBeLessThan(510_000)
  })
  it('100m apart', () => {
    // ~0.001 degrees lat ≈ 111m
    const dist = haversineMeters(40.0, 0.0, 40.0009, 0.0)
    expect(dist).toBeGreaterThan(80)
    expect(dist).toBeLessThan(120)
  })
})

describe('fmtMinutes', () => {
  it('formats hours and minutes', () => {
    expect(fmtMinutes(90)).toBe('1h 30m')
    expect(fmtMinutes(45)).toBe('45m')
    expect(fmtMinutes(480)).toBe('8h 00m')
  })
  it('formats zero as plain minutes', () => {
    expect(fmtMinutes(0)).toBe('0m')
  })
  it('treats negative minutes as positive magnitude', () => {
    expect(fmtMinutes(-90)).toBe('1h 30m')
    expect(fmtMinutes(-45)).toBe('45m')
  })
})

describe('avatarInitials', () => {
  it('uses first letter of first two words', () => {
    expect(avatarInitials('Felipe Gusmão')).toBe('FG')
  })
  it('handles single name', () => {
    expect(avatarInitials('João')).toBe('J')
  })
  it('uppercases lowercase input', () => {
    expect(avatarInitials('ana silva')).toBe('AS')
  })
  it('limits to two initials even with longer names', () => {
    expect(avatarInitials('Maria José da Silva')).toBe('MJ')
  })
  it('returns empty string for empty input', () => {
    expect(avatarInitials('')).toBe('')
  })
})

describe('businessDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const date = businessDate(new Date('2026-05-28T12:00:00Z'))
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('returns the same date for instants well within the same business day', () => {
    // Both noons UTC fall on the same calendar day in any reasonable timezone.
    const morning = businessDate(new Date('2026-05-28T09:00:00Z'))
    const afternoon = businessDate(new Date('2026-05-28T15:00:00Z'))
    expect(morning).toBe(afternoon)
  })
  it('advances by one day across a full 24h gap', () => {
    const d1 = businessDate(new Date('2026-05-28T12:00:00Z'))
    const d2 = businessDate(new Date('2026-05-29T12:00:00Z'))
    expect(d1).not.toBe(d2)
  })
})

import { calcWorkedMinutesPeriod, calcOvertimePeriod, calcOvertimeToday, calcHours, calcEarnings } from '../lib/utils'

describe('calcWorkedMinutesPeriod', () => {
  it('sums net minutes across multiple days (deducts lunch per day)', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T17:00:00Z'),
      rec('entrada', '2026-05-27T08:00:00Z'),
      rec('saída',   '2026-05-27T17:00:00Z'),
    ]
    // each day: 9h - 60min lunch = 480min; total = 960
    expect(calcWorkedMinutesPeriod(records, 60)).toBe(960)
  })

  it('returns 0 for empty records', () => {
    expect(calcWorkedMinutesPeriod([], 60)).toBe(0)
  })

  it('incomplete day (no saída) contributes 0 to period total', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T17:00:00Z'),
      rec('entrada', '2026-05-27T08:00:00Z'), // no saída
    ]
    expect(calcWorkedMinutesPeriod(records, 60)).toBe(480)
  })
})

describe('calcOvertimePeriod', () => {
  it('positive overtime when worked more than workday', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T18:00:00Z'), // 10h - 60min lunch = 540min vs 480min target → +60min
    ]
    expect(calcOvertimePeriod(records, 480, 60)).toBe(60)
  })

  it('negative overtime when worked less than workday', () => {
    const records = [
      rec('entrada', '2026-05-26T09:00:00Z'),
      rec('saída',   '2026-05-26T15:00:00Z'), // 6h - 60min lunch = 300min vs 480min → -180min
    ]
    expect(calcOvertimePeriod(records, 480, 60)).toBe(-180)
  })

  it('returns null for empty records', () => {
    expect(calcOvertimePeriod([], 480, 60)).toBeNull()
  })
})

describe('calcOvertimeToday', () => {
  it('returns overtime for a completed day', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T17:00:00Z'), // 9h - 60min = 480min → 0 overtime
    ]
    expect(calcOvertimeToday(records, 480, 60)).toBe(0)
  })

  it('returns null when no work recorded', () => {
    expect(calcOvertimeToday([], 480, 60)).toBeNull()
  })
})

describe('calcHours', () => {
  it('formats a worked period correctly', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T16:30:00Z'), // 8.5h - 60min = 450min = 7h30m
    ]
    expect(calcHours(records, 60)).toBe('7h 30m')
  })

  it('returns — for no records', () => {
    expect(calcHours([], 60)).toBe('—')
  })

  it('returns — for incomplete day (no saída)', () => {
    expect(calcHours([rec('entrada', '2026-05-26T08:00:00Z')], 60)).toBe('—')
  })
})

describe('calcEarnings', () => {
  it('computes earnings from worked minutes and hourly rate', () => {
    const records = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T16:00:00Z'), // 8h - 60min = 420min = 7h
    ]
    // 7h × 10€/h = 70€
    const result = calcEarnings(records, 10, 60)
    expect(result).toContain('70')
  })

  it('returns 0€ for no records', () => {
    const result = calcEarnings([], 10, 60)
    expect(result).toContain('0')
  })
})

import { roundToQuarter, fmtCentesimal, fmtCentesimalSigned, calcDayRounded } from '../lib/utils'

describe('roundToQuarter', () => {
  it('snaps to the nearest 15-min mark (down then up)', () => {
    expect(roundToQuarter(0)).toBe(0)
    expect(roundToQuarter(7)).toBe(0)       // < 7.5 → down
    expect(roundToQuarter(8)).toBe(15)      // > 7.5 → up
    expect(roundToQuarter(13)).toBe(15)     // user's example: 17h13 → 17h15
    expect(roundToQuarter(22)).toBe(15)
    expect(roundToQuarter(23)).toBe(30)
    expect(roundToQuarter(60)).toBe(60)
    expect(roundToQuarter(465)).toBe(465)   // 7h45 → 7h45
  })
  it('handles negatives by magnitude', () => {
    expect(roundToQuarter(-13)).toBe(-15)
    expect(roundToQuarter(-7)).toBe(0)
  })
  it('breaks ties upward (JS Math.round behaviour)', () => {
    expect(roundToQuarter(7.5)).toBe(15)
    expect(roundToQuarter(22.5)).toBe(30)
  })
})

describe('fmtCentesimal', () => {
  it('formats whole hours and quarters', () => {
    expect(fmtCentesimal(0)).toBe('0,00')
    expect(fmtCentesimal(15)).toBe('0,25')
    expect(fmtCentesimal(30)).toBe('0,50')
    expect(fmtCentesimal(45)).toBe('0,75')
    expect(fmtCentesimal(60)).toBe('1,00')
    expect(fmtCentesimal(465)).toBe('7,75')  // 7h45m
  })
  it('treats negatives as magnitudes (no sign)', () => {
    expect(fmtCentesimal(-60)).toBe('1,00')
  })
})

describe('fmtCentesimalSigned', () => {
  it('prefixes + for credit and − for debit', () => {
    expect(fmtCentesimalSigned(60)).toBe('+1,00')
    expect(fmtCentesimalSigned(-60)).toBe('−1,00')
    expect(fmtCentesimalSigned(0)).toBe('+0,00')
    expect(fmtCentesimalSigned(-15)).toBe('−0,25')
  })
})

describe('calcDayRounded', () => {
  it('rounds the day net to the nearest quarter (with auto-lunch)', () => {
    // entrada 08:00 → saída 17:13 → 9h13 gross. Auto-lunch 60min → 8h13 net (493 min).
    // Rounded to nearest 15-min = 495 min.
    const records: PunchRecord[] = [
      rec('entrada', '2026-05-26T08:00:00Z'),
      rec('saída',   '2026-05-26T17:13:00Z'),
    ]
    expect(calcDayRounded(records, 60)).toBe(495)
  })
  it('returns 0 for empty records', () => {
    expect(calcDayRounded([], 60)).toBe(0)
  })
})
