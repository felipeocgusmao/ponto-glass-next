'use client'

import type { PunchRecord } from '@/lib/types'
import { WORKING_TYPES, EXPLICIT_BREAK_TYPES, calcTimeBreakdown, calcNetMinutes, openPayslip, empColor } from '@/lib/utils'
export { openPayslip, empColor }

export function SL({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 12, ...style }}>
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
  const gross = totalWorked + ongoing
  // While the worker is still IN (no saída yet), show gross elapsed time — deducting
  // the assumed lunch upfront would mislead someone who just punched in to see 0
  // minutes worked. The assumed lunch is only subtracted once the day is closed
  // (state !== 'working'), matching how reports/payslips compute net work.
  const lunchToDeduct = state === 'working' ? 0 : lunchAuto
  return Math.max(0, gross - lunchToDeduct)
}

export function fmtMin(min: number): string {
  const abs = Math.round(Math.abs(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

export function ProgressRing({ pct, overtime, label }: { pct: number; overtime: boolean; label?: string }) {
  const r = 42, c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, pct / 100))
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="6"/>
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={overtime ? 'var(--warning-fg)' : pct >= 100 ? 'var(--success-fg)' : 'var(--accent)'}
        strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="49" textAnchor="middle" dominantBaseline="middle"
        fontSize="16" fontWeight="600" fill="var(--fg)"
        fontFamily="var(--font-mono)" letterSpacing="-0.02em">
        {Math.round(Math.min(pct, 999))}%
      </text>
      {label && (
        <text x="50" y="64" textAnchor="middle"
          fontSize="7" fill="var(--fg-subtle)" fontWeight="600" letterSpacing="0.05em">
          {label}
        </text>
      )}
    </svg>
  )
}

export async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  const { getPosition } = await import('@/lib/native')
  return getPosition(8000)
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

