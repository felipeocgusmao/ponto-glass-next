import { describe, it, expect } from 'vitest'
import {
  calcWorkDate,
  businessDate,
  calcNetMinutes,
  calcTimeBreakdown,
  haversineMeters,
  fmtMinutes,
  isIncompleteDay,
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
    // 5h worked before lunch + 3h after = 8h = 480min
    expect(calcNetMinutes(records, 60)).toBe(480)
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
})
