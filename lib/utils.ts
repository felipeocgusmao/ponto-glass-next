import type { PunchRecord } from './types'

export const WORKDAY_MINUTES = 8 * 60

const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']
export const WORKING_TYPES  = ['entrada', 'fim_almoco', 'retorno_cafe']

// ─── Legacy pair-based (entrada/saída only) ────────────────────────────────────
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

// ─── State-machine breakdown (supports explicit break types) ───────────────────
export interface TimeBreakdown {
  workedMin: number
  lunchMin: number
  coffeeMin: number
}

export function calcTimeBreakdown(records: PunchRecord[]): TimeBreakdown {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  type State = 'out' | 'working' | 'lunch' | 'coffee'
  let state: State = 'out'
  let lastT: number | null = null
  let workedMs = 0, lunchMs = 0, coffeeMs = 0

  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime()
    if (lastT !== null) {
      const delta = t - lastT
      if (state === 'working')      workedMs += delta
      else if (state === 'lunch')   lunchMs  += delta
      else if (state === 'coffee')  coffeeMs += delta
    }
    switch (r.type) {
      case 'entrada':
      case 'fim_almoco':
      case 'retorno_cafe': state = 'working'; break
      case 'saída':        state = 'out';     break
      case 'inicio_almoco': state = 'lunch';  break
      case 'pausa_cafe':   state = 'coffee';  break
    }
    lastT = t
  }
  return {
    workedMin: Math.round(workedMs / 60_000),
    lunchMin:  Math.round(lunchMs  / 60_000),
    coffeeMin: Math.round(coffeeMs / 60_000),
  }
}

function hasExplicitBreaks(records: PunchRecord[]): boolean {
  return records.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
}

export function calcNetMinutes(records: PunchRecord[], lunchBreakMinutes = 0): number {
  if (hasExplicitBreaks(records)) return Math.max(0, calcTimeBreakdown(records).workedMin)
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
  const abs = Math.round(Math.abs(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function calcOvertimeToday(
  records: PunchRecord[],
  workdayMinutes = WORKDAY_MINUTES,
  lunchBreakMinutes = 0,
): number | null {
  const worked = calcNetMinutes(records, lunchBreakMinutes)
  if (!worked) return null
  return worked - workdayMinutes
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
  byDay.forEach((dayRecs) => { totalNet += calcNetMinutes(dayRecs, lunchBreakMinutes) })
  if (!totalNet) return null
  return totalNet - workdayMinutes * byDay.size
}

export function calcEarnings(
  records: PunchRecord[],
  hourlyRate: number,
  lunchBreakMinutes = 0,
): string {
  const min = calcNetMinutes(records, lunchBreakMinutes)
  return ((min / 60) * hourlyRate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

export function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function exportCSV(
  records: PunchRecord[],
  filename: string,
  employees: { id: string; hourly_rate: number | null; lunch_break_minutes: number }[] = [],
): void {
  const empMap = new Map(employees.map(e => [e.id, e]))
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  // Group records: employee → date → records[]
  const byEmp = new Map<string, Map<string, PunchRecord[]>>()
  records.forEach(r => {
    if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, new Map())
    const empDays = byEmp.get(r.employee_id)!
    if (!empDays.has(r.date)) empDays.set(r.date, [])
    empDays.get(r.date)!.push(r)
  })

  const COL_HEADERS = ['Data', 'Entrada', 'Saída', 'Almoço (min)', 'Café (min)', 'Total Horas', 'Valor/h (€)', 'Ganhos (€)']
  const NCOLS = COL_HEADERS.length

  const lines: string[] = []
  const row = (...cells: string[]) => lines.push(cells.map(q).join(','))
  const blankRow = () => lines.push(Array(NCOLS).fill('""').join(','))
  const spanRow = (text: string) => {
    const cells = Array(NCOLS).fill('""')
    cells[0] = q(text)
    lines.push(cells.join(','))
  }

  row('RELATÓRIO DE PONTO', ...Array(NCOLS - 1).fill(''))
  blankRow()

  let grandTotalMin = 0
  let grandTotalEarnings = 0

  Array.from(byEmp.keys()).sort((a, b) => {
    const nameA = Array.from(byEmp.get(a)!.values())[0]?.[0]?.employee_name ?? ''
    const nameB = Array.from(byEmp.get(b)!.values())[0]?.[0]?.employee_name ?? ''
    return nameA.localeCompare(nameB, 'pt')
  }).forEach(empId => {
    const empDays = byEmp.get(empId)!
    const sampleRec = Array.from(empDays.values())[0]?.[0]
    const empName = sampleRec?.employee_name ?? empId
    const emp = empMap.get(empId)
    const rate = emp?.hourly_rate ?? null
    const autoLunch = emp?.lunch_break_minutes ?? 0

    spanRow(`── ${empName.toUpperCase()} ──`)
    row(...COL_HEADERS)

    let empTotalMin = 0
    let empTotalEarnings = 0

    Array.from(empDays.keys()).sort().forEach(date => {
      const day = empDays.get(date)!.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      const explicit = hasExplicitBreaks(day)
      const { workedMin, lunchMin, coffeeMin } = calcTimeBreakdown(day)
      const netMin     = explicit ? workedMin : Math.max(0, pairMinutes(day) - autoLunch)
      const dispLunch  = explicit ? lunchMin  : autoLunch
      const dispCoffee = explicit ? coffeeMin : 0

      const [year, month, dayNum] = date.split('-').map(Number)
      const dow = DAYS_PT[new Date(year, month - 1, dayNum).getDay()]
      const dateLabel = `${String(dayNum).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${dow})`

      const entries = day.filter(r => r.type === 'entrada')
        .map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      const exits = day.filter(r => r.type === 'saída')
        .map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))

      const dayEarnings = rate && netMin > 0 ? netMin / 60 * rate : 0
      const earningsStr = rate != null ? dayEarnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'

      row(
        dateLabel,
        entries.join(' / ') || '—',
        exits.join(' / ')   || '—',
        String(dispLunch),
        String(dispCoffee),
        netMin > 0 ? fmtMinutes(netMin) : '—',
        rate != null ? `€ ${rate.toFixed(2)}` : '—',
        earningsStr,
      )

      empTotalMin += netMin
      empTotalEarnings += dayEarnings
    })

    const empEarningsStr = rate != null
      ? empTotalEarnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
      : '—'
    row(`SUBTOTAL ${empName.toUpperCase()}`, '', '', '', '', fmtMinutes(empTotalMin), '', empEarningsStr)
    blankRow()

    grandTotalMin += empTotalMin
    grandTotalEarnings += empTotalEarnings
  })

  const grandEarningsStr = grandTotalEarnings > 0
    ? grandTotalEarnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
    : '—'
  row('TOTAL GERAL', '', '', '', '', fmtMinutes(grandTotalMin), '', grandEarningsStr)

  const csv = lines.join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
