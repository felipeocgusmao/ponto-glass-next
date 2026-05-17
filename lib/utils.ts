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

export function calcHours(records: PunchRecord[]): string {
  const min = pairMinutes(records)
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

export function calcOvertimeToday(records: PunchRecord[]): number | null {
  const min = pairMinutes(records)
  if (!min) return null
  return min - WORKDAY_MINUTES
}

export function calcOvertimePeriod(records: PunchRecord[]): number | null {
  const min = pairMinutes(records)
  if (!min) return null
  const days = new Set(records.map((r) => r.date)).size
  return min - WORKDAY_MINUTES * days
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
