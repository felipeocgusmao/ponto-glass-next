import type { PunchRecord } from './types'

export const WORKDAY_MINUTES = 8 * 60

function pairMinutes(records: PunchRecord[]): number {
  const ins = records
    .filter((r) => r.type === 'entrada')
    .map((r) => new Date(r.timestamp))
    .sort((a, b) => a.getTime() - b.getTime())
  const outs = records
    .filter((r) => r.type === 'saída')
    .map((r) => new Date(r.timestamp))
    .sort((a, b) => a.getTime() - b.getTime())
  let totalMs = 0
  ins.forEach((t, i) => {
    if (outs[i] && outs[i] > t) totalMs += outs[i].getTime() - t.getTime()
  })
  return Math.round(totalMs / 60_000)
}

export function calcNetMinutes(records: PunchRecord[], lunchBreakMinutes = 0): number {
  return Math.max(0, pairMinutes(records) - lunchBreakMinutes)
}

export function calcHours(records: PunchRecord[], lunchBreakMinutes = 0): string {
  const min = calcNetMinutes(records, lunchBreakMinutes)
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function fmtMinutes(min: number): string {
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
}

export function calcOvertimeToday(
  records: PunchRecord[],
  workdayMinutes = WORKDAY_MINUTES,
  lunchBreakMinutes = 0,
): number | null {
  const worked = pairMinutes(records)
  if (!worked) return null
  return Math.max(0, worked - lunchBreakMinutes) - workdayMinutes
}

export function calcOvertimePeriod(
  records: PunchRecord[],
  workdayMinutes = WORKDAY_MINUTES,
  lunchBreakMinutes = 0,
): number | null {
  const byDay = new Map<string, PunchRecord[]>()
  records.forEach((r) => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })
  if (byDay.size === 0) return null
  let totalNet = 0
  byDay.forEach((dayRecs) => {
    totalNet += Math.max(0, pairMinutes(dayRecs) - lunchBreakMinutes)
  })
  if (!totalNet) return null
  return totalNet - workdayMinutes * byDay.size
}

export function calcEarnings(
  records: PunchRecord[],
  hourlyRate: number,
  lunchBreakMinutes = 0,
): string {
  const min = calcNetMinutes(records, lunchBreakMinutes)
  return ((min / 60) * hourlyRate).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  })
}

export function avatarInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function exportCSV(records: PunchRecord[], filename: string): void {
  const header = ['Data', 'Hora', 'Funcionário', 'Tipo']
  const rows = records.map((r) => [
    r.date,
    new Date(r.timestamp).toLocaleTimeString('pt-BR'),
    r.employee_name,
    r.type,
  ])
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
