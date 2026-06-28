// Punch-clock math ported verbatim from the web app's lib/utils.ts so the
// extension's worked-minutes / state / "today" boundary match it exactly.
// Keep in sync if the source ever changes.

import { CONFIG } from '../config.js'

export const WORKING_TYPES = ['entrada', 'fim_almoco', 'retorno_cafe']
export const EXPLICIT_BREAK_TYPES = ['inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

// Calendar date + wall-clock minutes of an instant, as seen in the business timezone.
function tzParts(date, timeZone = CONFIG.businessTz) {
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

export function businessDate(date = new Date()) {
  return tzParts(date).date
}

// ─── Legacy pair-based (entrada/saída only) ─────────────────────────────────────
function pairMinutes(records) {
  const ins = records.filter(r => r.type === 'entrada').map(r => new Date(r.timestamp)).sort((a, b) => a - b)
  const outs = records.filter(r => r.type === 'saída').map(r => new Date(r.timestamp)).sort((a, b) => a - b)
  let totalMs = 0
  ins.forEach((t, i) => { if (outs[i] && outs[i] > t) totalMs += outs[i].getTime() - t.getTime() })
  return Math.round(totalMs / 60_000)
}

// ─── State-machine breakdown (supports explicit break types) ────────────────────
export function calcTimeBreakdown(records) {
  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let state = 'out'
  let lastT = null
  let workedMs = 0, lunchMs = 0, coffeeMs = 0
  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime()
    if (lastT !== null) {
      const delta = t - lastT
      if (state === 'working') workedMs += delta
      else if (state === 'lunch') lunchMs += delta
      else if (state === 'coffee') coffeeMs += delta
    }
    switch (r.type) {
      case 'entrada':
      case 'fim_almoco':
      case 'retorno_cafe': state = 'working'; break
      case 'saída': state = 'out'; break
      case 'inicio_almoco': state = 'lunch'; break
      case 'pausa_cafe': state = 'coffee'; break
    }
    lastT = t
  }
  return {
    workedMin: Math.round(workedMs / 60_000),
    lunchMin: Math.round(lunchMs / 60_000),
    coffeeMin: Math.round(coffeeMs / 60_000),
  }
}

function hasExplicitBreaks(records) {
  return records.some(r => EXPLICIT_BREAK_TYPES.includes(r.type))
}

export function calcNetMinutes(records, lunchBreakMinutes = 0) {
  if (hasExplicitBreaks(records)) {
    const { workedMin, coffeeMin } = calcTimeBreakdown(records)
    return Math.max(0, workedMin + coffeeMin)
  }
  return Math.max(0, pairMinutes(records) - lunchBreakMinutes)
}

export function fmtMinutes(min) {
  const abs = Math.round(Math.abs(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

// ─── Work state ─────────────────────────────────────────────────────────────────
export function getWorkState(recs) {
  if (!recs.length) return { state: 'absent', since: null }
  const sorted = [...recs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const last = sorted[sorted.length - 1]
  if (WORKING_TYPES.includes(last.type)) return { state: 'working', since: last.timestamp }
  if (last.type === 'inicio_almoco') return { state: 'lunch', since: last.timestamp }
  if (last.type === 'pausa_cafe') return { state: 'coffee', since: last.timestamp }
  if (last.type === 'saída') return { state: 'out', since: last.timestamp }
  return { state: 'absent', since: null }
}

export function calcLiveMin(recs, lunchAuto) {
  const { state, since } = getWorkState(recs)
  if (hasExplicitBreaks(recs)) {
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
