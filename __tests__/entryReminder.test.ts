import { describe, expect, it } from 'vitest'
import {
  dueEntryReminderIds,
  formatClock,
  isExpectedStartWithinWindow,
  minutesUntilExpectedStart,
  parseTimeToMinutes,
} from '@/lib/entryReminder'

describe('entry reminder scheduling helpers', () => {
  it('parses HH:mm and HH:mm:ss values', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510)
    expect(parseTimeToMinutes('08:30:00')).toBe(510)
    expect(parseTimeToMinutes(null)).toBeNull()
    expect(parseTimeToMinutes('24:00')).toBeNull()
    expect(parseTimeToMinutes('not-a-time')).toBeNull()
  })

  it('keeps reminders inside the next-hour window only', () => {
    expect(minutesUntilExpectedStart('09:00', 8 * 60)).toBe(60)
    expect(isExpectedStartWithinWindow('09:00', 8 * 60, 60)).toBe(true)
    expect(isExpectedStartWithinWindow('09:01', 8 * 60, 60)).toBe(false)
    expect(isExpectedStartWithinWindow('07:59', 8 * 60, 60)).toBe(false)
  })

  it('returns due employee ids without including unscheduled employees', () => {
    const ids = dueEntryReminderIds([
      { id: 'due', expected_start: '08:30' },
      { id: 'too-late', expected_start: '09:31' },
      { id: 'missing', expected_start: null },
    ], 8 * 60 + 30, 60)

    expect(ids).toEqual(new Set(['due']))
  })

  it('formats clock minutes safely', () => {
    expect(formatClock(8 * 60 + 5)).toBe('08:05')
    expect(formatClock(24 * 60 + 15)).toBe('00:15')
  })
})
