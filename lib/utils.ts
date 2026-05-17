import type { PunchRecord } from './types'

export function calcHours(records: PunchRecord[]): string {
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
    if (outs[i] && outs[i] > t) {
      totalMs += outs[i].getTime() - t.getTime()
    }
  })

  if (!totalMs) return '—'
  const h = Math.floor(totalMs / 3_600_000)
  const m = Math.floor((totalMs % 3_600_000) / 60_000)
  return `${h}h ${m.toString().padStart(2, '0')}m`
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
