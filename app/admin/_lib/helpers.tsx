'use client'

import type { PunchRecord } from '@/lib/types'
import { WORKING_TYPES, calcTimeBreakdown, calcNetMinutes, fmtMinutes } from '@/lib/utils'
import { EXPLICIT_BREAK_TYPES } from './types'

export function empColor(id: string): number { return (id.charCodeAt(0) % 8) + 1 }

export function SL({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

type WorkState = 'working' | 'lunch' | 'coffee' | 'off'

export function getWorkState(recs: PunchRecord[]): { state: WorkState; since: string | null } {
  if (recs.length === 0) return { state: 'off', since: null }
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const last = sorted.at(-1)!
  const since = new Date(last.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (last.type === 'inicio_almoco') return { state: 'lunch', since }
  if (last.type === 'pausa_cafe') return { state: 'coffee', since }
  if (last.type === 'saída') return { state: 'off', since }
  if (WORKING_TYPES.includes(last.type)) return { state: 'working', since }
  return { state: 'off', since }
}

export function calcLiveMin(recs: PunchRecord[], lunchAuto: number): number {
  const hasBreaks = recs.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
  const { state } = getWorkState(recs)
  if (hasBreaks) {
    const bd = calcTimeBreakdown(recs)
    if (state !== 'working') return bd.workedMin
    const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastWork = sorted.slice().reverse().find(r => WORKING_TYPES.includes(r.type))
    const ongoing = lastWork ? (Date.now() - new Date(lastWork.timestamp).getTime()) / 60000 : 0
    return Math.max(0, bd.workedMin + ongoing)
  }
  const totalWorked = calcNetMinutes(recs, 0)
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const lastEntry = state === 'working' ? sorted.slice().reverse().find(r => r.type === 'entrada') : undefined
  const ongoing = lastEntry ? (Date.now() - new Date(lastEntry.timestamp).getTime()) / 60000 : 0
  return Math.max(0, totalWorked + ongoing - lunchAuto)
}

export function fmtMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

export function ProgressRing({ pct, overtime }: { pct: number; overtime: boolean }) {
  const r = 42, c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, pct / 100))
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="6"/>
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={overtime ? 'var(--warning-fg)' : pct >= 100 ? 'var(--success-fg)' : 'var(--accent)'}
        strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

export async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(res => {
    if (!navigator.geolocation) { res(null); return }
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 8000 }
    )
  })
}

export function getWorkingDays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function openPayslip(
  empName: string, period: string, recs: PunchRecord[],
  workdayHours: number, lunchMin: number, hourlyRate: number | null,
) {
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
    const netMin = explicit ? workedMin : Math.max(0, day.filter(r=>r.type==='entrada').length > 0 ? workedMin - lunchMin : 0)
    const dispLunch = explicit ? lMin : lunchMin
    const dispCoffee = explicit ? coffeeMin : 0
    const [y,m,dNum] = date.split('-').map(Number)
    const dow = DAYS_PT[new Date(y,m-1,dNum).getDay()]
    const dateLabel = `${String(dNum).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y} (${dow})`
    const entries = day.filter(r=>r.type==='entrada').map(r=>new Date(r.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))
    const exits = day.filter(r=>r.type==='saída').map(r=>new Date(r.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))
    const earn = hourlyRate && netMin > 0 ? netMin/60*hourlyRate : 0
    totalMin += netMin; totalEarnings += earn
    const rateCell = hourlyRate != null ? `<td>${Number(hourlyRate).toFixed(2).replace('.',',')} €</td>` : ''
    const earnCell = hourlyRate != null ? `<td>${earn.toFixed(2).replace('.',',')} €</td>` : ''
    return `<tr><td>${dateLabel}</td><td>${entries.join(' / ')||'-'}</td><td>${exits.join(' / ')||'-'}</td><td>${dispLunch}</td><td>${dispCoffee}</td><td>${netMin>0?fmtMinutes(netMin):'-'}</td>${rateCell}${earnCell}</tr>`
  }).join('')
  const rateHeader = hourlyRate != null ? '<th>€/hora</th>' : ''
  const earnHeader = hourlyRate != null ? '<th>Ganhos (€)</th>' : ''
  const rateTotal = hourlyRate != null ? '<td></td>' : ''
  const earnTotal = hourlyRate != null ? `<td>${totalEarnings.toFixed(2).replace('.',',')} €</td>` : ''
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Holerite ${empName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#333;padding:24px;max-width:960px;margin:0 auto;font-size:13px}
h1{font-size:20px;margin-bottom:4px}.sub{color:#666;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f0f0f0;border:1px solid #ddd;padding:7px 10px;text-align:left;font-size:12px}
td{border:1px solid #ddd;padding:7px 10px;font-size:12px}.total-row{font-weight:bold;background:#f8f8f8}
.btn{margin-top:20px;padding:10px 24px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px}
@media print{.btn{display:none}}</style></head><body>
<h1>Holerite — ${empName}</h1>
<div class="sub">Período: ${period} · Jornada: ${workdayHours}h · Almoço: ${lunchMin>0?lunchMin+'min':'sem desconto'}${hourlyRate!=null?` · €${Number(hourlyRate).toFixed(2)}/h`:''}</div>
<table><thead><tr><th>Data</th><th>Entrada</th><th>Saída</th><th>Almoço (min)</th><th>Café (min)</th><th>Total Horas</th>${rateHeader}${earnHeader}</tr></thead>
<tbody>${rows}<tr class="total-row"><td colspan="5">TOTAL</td><td>${fmtMinutes(totalMin)}</td>${rateTotal}${earnTotal}</tr></tbody></table>
<button class="btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}
