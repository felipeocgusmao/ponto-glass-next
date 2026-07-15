import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import {
  calcWorkedMinutesPeriod,
  calcOvertimePeriod,
  isIncompleteDay,
} from '@/lib/utils'
import { sendMonthlyReportEmployeeEmail, sendMonthlyReportAdminEmail } from '@/lib/email'
import { targetMinutesForDate } from '@/lib/schedule'
import { activeTenantIds } from '@/lib/tenant'
import type { Employee, PunchRecord } from '@/lib/types'

interface WeekParams { from: string; to: string; label: string; tenantId: string }

function prevWeekParams(tenantId: string): WeekParams {
  const now = new Date()
  // Go back to last Monday
  const day = now.getUTCDay() // 0 = Sunday
  const daysToMon = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setUTCDate(now.getUTCDate() - daysToMon - 7)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const from = fmt(mon)
  const to = fmt(sun)
  const label = `Semana de ${pad(mon.getUTCDate())}/${pad(mon.getUTCMonth() + 1)} a ${pad(sun.getUTCDate())}/${pad(sun.getUTCMonth() + 1)}`
  return { from, to, label, tenantId }
}

async function runReport(params: WeekParams) {
  const { from, to, label, tenantId } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, email, role, workday_hours, lunch_break_minutes, hourly_rate, active, weekly_schedule')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (!employees?.length) return { sent: 0, period: label }

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to)
    .order('timestamp', { ascending: true })

  const byEmp = new Map<string, PunchRecord[]>()
  ;(records ?? []).forEach((r: PunchRecord) => {
    if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, [])
    byEmp.get(r.employee_id)!.push(r)
  })

  type EmpRow = {
    name: string; workedMin: number; overtimeMin: number
    earnings: number | null; days: number; incompleteDays: number
  }

  const empRows: EmpRow[] = []
  let totalWorkedMin = 0
  let totalEarnings = 0
  let sent = 0

  const nonAdminEmps = (employees as Employee[]).filter(e => e.role !== 'admin' && e.role !== 'manager')

  for (const emp of nonAdminEmps) {
    const recs = byEmp.get(emp.id) ?? []
    if (!recs.length) continue
    const lunch = emp.lunch_break_minutes

    const workedMin = calcWorkedMinutesPeriod(recs, lunch)
    const overtimeMin = calcOvertimePeriod(recs, d => targetMinutesForDate(emp, d), lunch) ?? 0
    const days = new Set(recs.map(r => r.date)).size

    const byDate = new Map<string, PunchRecord[]>()
    recs.forEach(r => { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date)!.push(r) })
    let incompleteDays = 0
    byDate.forEach(d => { if (isIncompleteDay(d)) incompleteDays++ })

    const earnings = emp.hourly_rate != null ? (workedMin / 60) * Number(emp.hourly_rate) : null

    empRows.push({ name: emp.name, workedMin, overtimeMin, earnings, days, incompleteDays })
    totalWorkedMin += workedMin
    if (earnings != null) totalEarnings += earnings

    if (emp.email) {
      const ok = await sendMonthlyReportEmployeeEmail({
        to: emp.email, name: emp.name, period: label,
        workedMin, overtimeMin, earnings, days, incompleteDays, appUrl,
      })
      if (ok) sent++
    }
  }

  const admins = (employees as Employee[]).filter(e => (e.role === 'admin' || e.role === 'manager') && e.email)
  for (const admin of admins) {
    const ok = await sendMonthlyReportAdminEmail({
      to: admin.email!, adminName: admin.name, period: label,
      rows: empRows, totalWorkedMin, totalEarnings, appUrl,
    })
    if (ok) sent++
  }

  return { sent, period: label, employees: empRows.length }
}

// ── Vercel Cron (every Monday at 08h) ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let sent = 0
  let period = ''
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    try {
      const result = await runReport(prevWeekParams(tenantId))
      sent += result.sent
      period = result.period
    } catch { failures++ }
  }
  return NextResponse.json({ sent, period, failures })
}

// ── Manual trigger from admin panel ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runReport(prevWeekParams(user.tenant_id))
  return NextResponse.json(result)
}
