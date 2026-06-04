export interface EntryReminderEmployee {
  id: string
  expected_start: string | null
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const [hourPart, minutePart] = value.split(':')
  const hours = Number(hourPart)
  const minutes = Number(minutePart)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function businessClockMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

export function formatClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export function minutesUntilExpectedStart(expectedStart: string | null | undefined, nowMinutes: number): number | null {
  const startMinutes = parseTimeToMinutes(expectedStart)
  if (startMinutes == null) return null
  return startMinutes - nowMinutes
}

export function isExpectedStartWithinWindow(
  expectedStart: string | null | undefined,
  nowMinutes: number,
  lookAheadMinutes: number,
): boolean {
  const diff = minutesUntilExpectedStart(expectedStart, nowMinutes)
  return diff != null && diff >= 0 && diff <= lookAheadMinutes
}

export function dueEntryReminderIds<T extends EntryReminderEmployee>(
  employees: T[],
  nowMinutes: number,
  lookAheadMinutes: number,
): Set<string> {
  return new Set(
    employees
      .filter(employee => isExpectedStartWithinWindow(employee.expected_start, nowMinutes, lookAheadMinutes))
      .map(employee => employee.id),
  )
}
