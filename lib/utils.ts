import type { PunchRecord } from './types'

export const WORKDAY_MINUTES = 8 * 60

export const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']
export const WORKING_TYPES  = ['entrada', 'fim_almoco', 'retorno_cafe']

// The timezone the business operates in. A work "day" is the local calendar day
// in THIS zone — never UTC — so punches near midnight are filed under the day the
// employee actually worked. Override per-deployment with NEXT_PUBLIC_BUSINESS_TZ
// (an IANA name like 'Europe/Lisbon'); it must be NEXT_PUBLIC_ so the same value
// is available on both the server (write path) and the client (report ranges).
export const BUSINESS_TZ =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BUSINESS_TZ) || 'Europe/Lisbon'

// Calendar date + wall-clock time of an instant, as seen in the business timezone.
function tzParts(date: Date, timeZone: string = BUSINESS_TZ): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  let y = '', mo = '', d = '', h = '0', mi = '0'
  for (const p of parts) {
    if (p.type === 'year') y = p.value
    else if (p.type === 'month') mo = p.value
    else if (p.type === 'day') d = p.value
    else if (p.type === 'hour') h = p.value
    else if (p.type === 'minute') mi = p.value
  }
  return { date: `${y}-${mo}-${d}`, minutes: Number(h) * 60 + Number(mi) }
}

// Today's (or any instant's) calendar date in the business timezone, as YYYY-MM-DD.
// Use this everywhere instead of `new Date().toISOString().split('T')[0]`, which
// returns the UTC day and is wrong for the hours around local midnight.
export function businessDate(date: Date = new Date()): string {
  return tzParts(date).date
}

// Wall-clock minutes since midnight of an instant, in the business timezone.
// Use for comparisons against HH:MM business-local times (expected_start etc.) —
// Date.setHours() would use the runtime's TZ, which is UTC on the server.
export function businessMinutesOfDay(date: Date): number {
  return tzParts(date).minutes
}

// Local wall-clock hour (0–23) in the business timezone. Cron handlers use this
// as a guard so a job scheduled at two UTC hours (to cover summer/winter time)
// only runs on the invocation that matches the intended LOCAL hour (#286).
export function businessHourOfDay(date: Date = new Date()): number {
  return Math.floor(businessMinutesOfDay(date) / 60)
}

// Work date for a punch, honouring an employee's shift_start — the LOCAL
// (business-timezone) time of day at which a new workday begins. For night shifts
// (e.g. 22:00), punches before that local time belong to the previous calendar day.
// Both the punch write path and the "today" read filter MUST use this so they agree
// across midnight. shiftStart '00:00' = normal day shift (plain local calendar date).
export function calcWorkDate(punchTime: Date, shiftStart = '00:00'): string {
  const { date, minutes } = tzParts(punchTime)
  const [sh, sm] = shiftStart.split(':').map(Number)
  const shiftStartMin = (sh || 0) * 60 + (sm || 0)
  if (shiftStartMin <= 0 || minutes >= shiftStartMin) return date
  // Before the shift's start time → this punch belongs to the previous local day.
  const prev = new Date(`${date}T12:00:00Z`)
  prev.setUTCDate(prev.getUTCDate() - 1)
  return prev.toISOString().split('T')[0]
}

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
  if (hasExplicitBreaks(records)) {
    // Coffee breaks count as worked time; lunch is unpaid and excluded.
    const { workedMin, coffeeMin } = calcTimeBreakdown(records)
    return Math.max(0, workedMin + coffeeMin)
  }
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

// ── Centesimal hours (base 100) + quarter-hour rounding ─────────────────────────
// In "industrial" / centesimal hour notation each hour is split into 100 units
// instead of 60. So 7h45m → 7,75 and 7h13m → 7,21. The system rounds *worked
// minutes per day* to the nearest 15-minute mark first, so reported values always
// land on .00 / .25 / .50 / .75 — never a fractional centesimal like 7,21.

/** Round minutes to the nearest 15-minute mark. Negative values round in magnitude. */
export function roundToQuarter(min: number): number {
  const sign = min < 0 ? -1 : 1
  const rounded = sign * Math.round(Math.abs(min) / 15) * 15
  // Normalise -0 → 0 so === / Object.is comparisons stay clean.
  return rounded === 0 ? 0 : rounded
}

/** Format minutes as centesimal hours, e.g. 45 → "0,75", 465 → "7,75", -60 → "1,00". */
export function fmtCentesimal(min: number): string {
  const abs = Math.abs(min)
  return (abs / 60).toFixed(2).replace('.', ',')
}

/** Like fmtCentesimal but with a leading + / − sign — used for hour-bank deltas. */
export function fmtCentesimalSigned(min: number): string {
  const sign = min < 0 ? '−' : '+'
  return sign + fmtCentesimal(min)
}

/** Daily net minutes rounded to the nearest 15-min mark. The canonical
 *  "official" value used by reports, holerites, hour-bank and earnings.
 *  Live counters on /ponto stay exact via calcNetMinutes / calcTimeBreakdown. */
export function calcDayRounded(records: PunchRecord[], lunchBreakMinutes = 0): number {
  return roundToQuarter(calcNetMinutes(records, lunchBreakMinutes))
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
  // A number applies the same daily target to every day; a function receives
  // the 'YYYY-MM-DD' date so weekly schedules can vary the target per weekday.
  workdayMinutes: number | ((date: string) => number) = WORKDAY_MINUTES,
  lunchBreakMinutes = 0,
): number | null {
  const byDay = new Map<string, PunchRecord[]>()
  records.forEach((r) => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })
  if (byDay.size === 0) return null
  let totalNet = 0
  let totalTarget = 0
  // Sum the *rounded* daily net so overtime is computed against the same values
  // the employee sees in reports and the hour bank (matches centesimal rules).
  byDay.forEach((dayRecs, date) => {
    totalNet += calcDayRounded(dayRecs, lunchBreakMinutes)
    totalTarget += typeof workdayMinutes === 'function' ? workdayMinutes(date) : workdayMinutes
  })
  if (!totalNet) return null
  return totalNet - totalTarget
}

// Day-aware total worked minutes over a period: each day's net is computed (and its
// lunch deducted) separately, then summed — matching the CSV/PDF/payslip exports.
// Each day is rounded to the nearest 15-min mark before summing so the displayed
// total agrees with the rounded daily values printed on relatórios/holerites.
// Use this for on-screen period totals instead of calcNetMinutes(allRecords, lunch),
// which would subtract a single lunch for the whole range.
export function calcWorkedMinutesPeriod(records: PunchRecord[], lunchBreakMinutes = 0): number {
  const byDay = new Map<string, PunchRecord[]>()
  records.forEach((r) => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })
  let total = 0
  byDay.forEach((dayRecs) => { total += calcDayRounded(dayRecs, lunchBreakMinutes) })
  return total
}

// A day is "incomplete" when there is an entrada but no saída — someone forgot to clock
// out, so worked time can't be computed and the day would silently count as 0. Reports
// surface this explicitly instead of showing a misleading 0/—.
export function isIncompleteDay(records: PunchRecord[]): boolean {
  return records.some(r => r.type === 'entrada') && !records.some(r => r.type === 'saída')
}

export function calcEarnings(
  records: PunchRecord[],
  hourlyRate: number,
  lunchBreakMinutes = 0,
): string {
  const min = calcNetMinutes(records, lunchBreakMinutes)
  return ((min / 60) * hourlyRate).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

export function empColor(id: string): number { return (id.charCodeAt(0) % 8) + 1 }

export function fmtEur(v: number): string {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

export function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function exportCSV(
  records: PunchRecord[],
  filename: string,
  employees: { id: string; name?: string; hourly_rate: number | null; lunch_break_minutes: number }[] = [],
): void {
  const empMap = new Map(employees.map(e => [e.id, e]))
  const SEP = ';'
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

  const COL_HEADERS = ['Data', 'Entrada', 'Saida', 'Almoco (min)', 'Cafe (min)', 'Horas (centesimal)', 'Valor/h (EUR)', 'Ganhos (EUR)']
  const NCOLS = COL_HEADERS.length
  const fmtEur = (val: number) => val.toFixed(2).replace('.', ',')

  const lines: string[] = []
  const row = (...cells: string[]) => lines.push(cells.map(q).join(SEP))
  const blankRow = () => lines.push(Array(NCOLS).fill('""').join(SEP))
  const spanRow = (text: string) => {
    const cells = Array(NCOLS).fill('""')
    cells[0] = q(text)
    lines.push(cells.join(SEP))
  }

  row('RELATORIO DE PONTO', ...Array(NCOLS - 1).fill(''))
  blankRow()

  let grandTotalMin = 0
  let grandTotalEarnings = 0

  // Include employees missing from `employees` too (e.g. deactivated people with
  // records in the period) — the PDF export already does; the fallbacks below
  // (employee_name from the record, no rate, no auto-lunch) handle them.
  Array.from(byEmp.keys()).sort((a, b) => {
    const nameA = Array.from(byEmp.get(a)!.values())[0]?.[0]?.employee_name ?? ''
    const nameB = Array.from(byEmp.get(b)!.values())[0]?.[0]?.employee_name ?? ''
    return nameA.localeCompare(nameB, 'pt')
  }).forEach(empId => {
    const empDays = byEmp.get(empId)!
    const sampleRec = Array.from(empDays.values())[0]?.[0]
    const emp = empMap.get(empId)
    const empName = emp?.name ?? sampleRec?.employee_name ?? empId
    const rate = emp?.hourly_rate ?? null
    const autoLunch = emp?.lunch_break_minutes ?? 0

    spanRow(`=== ${empName.toUpperCase()} ===`)
    row(...COL_HEADERS)

    let empTotalMin = 0
    let empTotalEarnings = 0

    Array.from(empDays.keys()).sort().forEach(date => {
      const day = empDays.get(date)!.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      const explicit = hasExplicitBreaks(day)
      const { workedMin, lunchMin, coffeeMin } = calcTimeBreakdown(day)
      const exactNet   = explicit ? workedMin : Math.max(0, pairMinutes(day) - autoLunch)
      // Round each day to the nearest 15-min mark so the CSV total = sum of displayed rows.
      const netMin     = roundToQuarter(exactNet)
      const incomplete = isIncompleteDay(day)
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

      row(
        dateLabel,
        entries.join(' / ') || '-',
        exits.join(' / ')   || '-',
        String(dispLunch),
        String(dispCoffee),
        incomplete ? 'INCOMPLETO (sem saida)' : (netMin > 0 ? fmtCentesimal(netMin) : '-'),
        rate != null ? rate.toFixed(2).replace('.', ',') : '-',
        rate != null ? fmtEur(dayEarnings) : '-',
      )

      empTotalMin += netMin
      empTotalEarnings += dayEarnings
    })

    row(`SUBTOTAL ${empName.toUpperCase()}`, '', '', '', '', fmtCentesimal(empTotalMin), '', rate != null ? fmtEur(empTotalEarnings) : '-')
    blankRow()

    grandTotalMin += empTotalMin
    grandTotalEarnings += empTotalEarnings
  })

  row('TOTAL GERAL', '', '', '', '', fmtCentesimal(grandTotalMin), '', fmtEur(grandTotalEarnings))

  const csv = `sep=${SEP}\n` + lines.join('\n')
  const encoder = new TextEncoder()
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
  const blob = new Blob([bom, encoder.encode(csv)], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportPDF(
  records: PunchRecord[],
  filename: string,
  employees: { id: string; name?: string; hourly_rate: number | null; lunch_break_minutes: number }[],
  period: string,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const empMap = new Map(employees.map(e => [e.id, e]))
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const byEmp = new Map<string, Map<string, PunchRecord[]>>()
  records.forEach(r => {
    if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, new Map())
    const em = byEmp.get(r.employee_id)!
    if (!em.has(r.date)) em.set(r.date, [])
    em.get(r.date)!.push(r)
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('PontoGlass — Relatório de Ponto', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Período: ${period}`, 14, 25)
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`, 14, 30)
  doc.setTextColor(0)

  let grandTotalMin = 0
  let grandTotalEarnings = 0
  let yPos = 38

  const empIds = Array.from(byEmp.keys()).sort((a, b) => {
    const na = empMap.get(a)?.name ?? ''
    const nb = empMap.get(b)?.name ?? ''
    return na.localeCompare(nb, 'pt')
  })

  for (const empId of empIds) {
    const emp = empMap.get(empId)
    const empDays = byEmp.get(empId)!
    const sampleName = Array.from(empDays.values())[0]?.[0]?.employee_name ?? empId
    const empName = emp?.name ?? sampleName
    const rate = emp?.hourly_rate ?? null
    const autoLunch = emp?.lunch_break_minutes ?? 0
    const hasRate = rate != null

    const rows: (string | number)[][] = []
    let empTotalMin = 0
    let empTotalEarnings = 0

    Array.from(empDays.keys()).sort().forEach(date => {
      const day = [...empDays.get(date)!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const explicit = day.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
      const { workedMin, lunchMin, coffeeMin } = calcTimeBreakdown(day)
      const exactNet = Math.max(0, calcNetMinutes(day, autoLunch))
      // Round each day to the nearest 15-min mark so the PDF total = sum of displayed rows.
      const netMin = roundToQuarter(exactNet)
      const incomplete = isIncompleteDay(day)
      const dispLunch = explicit ? lunchMin : autoLunch
      const dispCoffee = explicit ? coffeeMin : 0

      const [y, m, dNum] = date.split('-').map(Number)
      const dow = DAYS_PT[new Date(y, m - 1, dNum).getDay()]
      const dateLabel = `${String(dNum).padStart(2,'0')}/${String(m).padStart(2,'0')} (${dow})`
      const entries = day.filter(r => r.type === 'entrada').map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      const exits   = day.filter(r => r.type === 'saída').map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      const dayEarnings = rate && netMin > 0 ? netMin / 60 * rate : 0

      const row: (string | number)[] = [
        dateLabel,
        entries.join(' / ') || '-',
        exits.join(' / ') || '-',
        dispLunch > 0 ? String(dispLunch) : '-',
        dispCoffee > 0 ? String(dispCoffee) : '-',
        incomplete ? 'Incompleto' : (netMin > 0 ? fmtCentesimal(netMin) : '-'),
      ]
      if (hasRate) {
        row.push(rate!.toFixed(2))
        row.push(netMin > 0 ? dayEarnings.toFixed(2) : '-')
      }
      rows.push(row)
      empTotalMin += netMin
      empTotalEarnings += dayEarnings
    })

    const totalRow: (string | number)[] = ['TOTAL', '', '', '', '', fmtCentesimal(empTotalMin)]
    if (hasRate) { totalRow.push(''); totalRow.push(empTotalEarnings.toFixed(2) + ' €') }

    const head: string[] = ['Data', 'Entrada', 'Saída', 'Almoço (min)', 'Café (min)', 'Horas (centesimal)']
    if (hasRate) { head.push('€/hora'); head.push('Ganhos (€)') }

    if (yPos > 240) { doc.addPage(); yPos = 20 }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(empName, 14, yPos)
    yPos += 5

    autoTable(doc, {
      startY: yPos,
      head: [head],
      body: rows,
      foot: [totalRow],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [94, 106, 210], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 14, right: 14 },
      tableWidth: pageW - 28,
    })

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    grandTotalMin += empTotalMin
    grandTotalEarnings += empTotalEarnings
  }

  if (empIds.length > 1) {
    if (yPos > 250) { doc.addPage(); yPos = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`TOTAL GERAL: ${fmtCentesimal(grandTotalMin)}${grandTotalEarnings > 0 ? ` · ${grandTotalEarnings.toFixed(2)} €` : ''}`, 14, yPos)
  }

  doc.save(filename)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function openPayslip(
  empName: string, period: string, recs: PunchRecord[],
  workdayHours: number, lunchMin: number, hourlyRate: number | null,
) {
  const safeName = escapeHtml(empName)
  const safePeriod = escapeHtml(period)
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const byDate = new Map<string, PunchRecord[]>()
  recs.forEach(r => {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  })
  let totalMin = 0, totalEarnings = 0
  const rows = Array.from(byDate.keys()).sort().map(date => {
    const day = [...byDate.get(date)!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const explicit = day.some(r => ['inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(r.type))
    const { workedMin, lunchMin: lMin, coffeeMin } = calcTimeBreakdown(day)
    const exactNet = explicit ? workedMin : Math.max(0, day.filter(r => r.type === 'entrada').length > 0 ? workedMin - lunchMin : 0)
    // Round each day to the nearest 15-min mark so the holerite total = sum of displayed rows.
    const netMin = roundToQuarter(exactNet)
    const incomplete = isIncompleteDay(day)
    const dispLunch = explicit ? lMin : lunchMin
    const dispCoffee = explicit ? coffeeMin : 0
    const [y, m, dNum] = date.split('-').map(Number)
    const dow = DAYS_PT[new Date(y, m - 1, dNum).getDay()]
    const dateLabel = `${String(dNum).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} (${dow})`
    const entries = day.filter(r => r.type === 'entrada').map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    const exits = day.filter(r => r.type === 'saída').map(r => new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    const earn = hourlyRate && netMin > 0 ? netMin / 60 * hourlyRate : 0
    totalMin += netMin; totalEarnings += earn
    const rateCell = hourlyRate != null ? `<td>${Number(hourlyRate).toFixed(2).replace('.', ',')} €</td>` : ''
    const earnCell = hourlyRate != null ? `<td>${earn.toFixed(2).replace('.', ',')} €</td>` : ''
    const totalCell = incomplete ? '<span style="color:#c00;font-weight:600">Incompleto</span>' : (netMin > 0 ? fmtCentesimal(netMin) : '-')
    return `<tr><td>${dateLabel}</td><td>${entries.join(' / ') || '-'}</td><td>${exits.join(' / ') || '-'}</td><td>${dispLunch}</td><td>${dispCoffee}</td><td>${totalCell}</td>${rateCell}${earnCell}</tr>`
  }).join('')
  const rateHeader = hourlyRate != null ? '<th>€/hora</th>' : ''
  const earnHeader = hourlyRate != null ? '<th>Ganhos (€)</th>' : ''
  const rateTotal  = hourlyRate != null ? '<td></td>' : ''
  const earnTotal  = hourlyRate != null ? `<td>${totalEarnings.toFixed(2).replace('.', ',')} €</td>` : ''
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Holerite ${safeName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#333;padding:24px;max-width:960px;margin:0 auto;font-size:13px}
h1{font-size:20px;margin-bottom:4px}.sub{color:#666;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f0f0f0;border:1px solid #ddd;padding:7px 10px;text-align:left;font-size:12px}
td{border:1px solid #ddd;padding:7px 10px;font-size:12px}.total-row{font-weight:bold;background:#f8f8f8}
.btn{margin-top:20px;padding:10px 24px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px}
@media print{.btn{display:none}}</style></head><body>
<h1>Holerite — ${safeName}</h1>
<div class="sub">Período: ${safePeriod} · Jornada: ${workdayHours}h · Almoço: ${lunchMin > 0 ? lunchMin + 'min' : 'sem desconto'}${hourlyRate != null ? ` · €${Number(hourlyRate).toFixed(2)}/h` : ''}</div>
<table><thead><tr><th>Data</th><th>Entrada</th><th>Saída</th><th>Almoço (min)</th><th>Café (min)</th><th>Horas (centesimal)</th>${rateHeader}${earnHeader}</tr></thead>
<tbody>${rows}<tr class="total-row"><td colspan="5">TOTAL</td><td>${fmtCentesimal(totalMin)}</td>${rateTotal}${earnTotal}</tr></tbody></table>
<button class="btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Work state ───────────────────────────────────────────────────────────────
export type WorkState = 'absent' | 'working' | 'lunch' | 'coffee' | 'out'

export function getWorkState(recs: PunchRecord[]): { state: WorkState; since: string | null } {
  if (!recs.length) return { state: 'absent', since: null }
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted[sorted.length - 1]
  if (WORKING_TYPES.includes(last.type)) return { state: 'working', since: last.timestamp }
  if (last.type === 'inicio_almoco') return { state: 'lunch', since: last.timestamp }
  if (last.type === 'pausa_cafe') return { state: 'coffee', since: last.timestamp }
  if (last.type === 'saída') return { state: 'out', since: last.timestamp }
  return { state: 'absent', since: null }
}

export function calcLiveMin(recs: PunchRecord[], lunchAuto: number): number {
  const { state, since } = getWorkState(recs)
  const hasBreaks = recs.some(r => ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe'].includes(r.type))
  if (hasBreaks) {
    const { workedMin, coffeeMin } = calcTimeBreakdown(recs)
    const completed = workedMin + coffeeMin
    if ((state === 'working' || state === 'coffee') && since)
      return Math.round(completed + (Date.now() - new Date(since).getTime()) / 60_000)
    return Math.round(completed)
  }
  const base = calcNetMinutes(recs, lunchAuto)
  if (state === 'working' && since)
    return Math.round(base + (Date.now() - new Date(since).getTime()) / 60_000)
  return Math.round(base)
}

// ── Geofencing ────────────────────────────────────────────────────────────────
// Returns distance in metres between two GPS coordinates (Haversine formula).
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000 // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── CSV export ───────────────────────────────────────────────────────────────

export function exportPunchCsv(empName: string, monthLabel: string, records: PunchRecord[]): void {
  const PUNCH_LABEL: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
    pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
  }
  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const header = 'Data,Tipo,Hora'
  const lines = sorted.map(r => {
    const time = new Date(r.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    const label = PUNCH_LABEL[r.type] ?? r.type
    return `${r.date},"${label}",${time}`
  })
  const csv = '﻿' + [header, ...lines].join('\n') // BOM prefix for Excel UTF-8 compatibility
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ponto_${empName.replace(/\s+/g, '_')}_${monthLabel.replace(/[\s/]/g, '_')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
