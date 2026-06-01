import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { verifyApiAuth } from '@/lib/apiAuth'
import {
  calcWorkedMinutesPeriod,
  calcOvertimePeriod,
  isIncompleteDay,
} from '@/lib/utils'
import { sendMonthlyReportEmployeeEmail, sendMonthlyReportAdminEmail } from '@/lib/email'
import type { Employee, PunchRecord } from '@/lib/types'

interface ReportParams { year: number; month: number }

function prevMonthParams(): ReportParams {
  const now = new Date()
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  return { year, month }
}

function buildRange(p: ReportParams): { from: string; to: string; label: string } {
  const from  = `${p.year}-${String(p.month).padStart(2, '0')}-01`
  const last  = new Date(p.year, p.month, 0).getDate()
  const to    = `${p.year}-${String(p.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  const label = new Date(`${from}T12:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return { from, to, label }
}

async function runReport(params: ReportParams) {
  const { from, to, label } = buildRange(params)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, email, role, workday_hours, lunch_break_minutes, hourly_rate, active')
    .eq('active', true)

  if (!employees?.length) return { sent: 0, period: label }

  const { data: records } = await supabase
    .from('records')
    .select('*')
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
  let totalWorkedMin  = 0
  let totalEarnings   = 0
  let sent = 0

  const nonAdminEmps = (employees as Employee[]).filter(e => e.role !== 'admin' && e.role !== 'manager')

  for (const emp of nonAdminEmps) {
    const recs   = byEmp.get(emp.id) ?? []
    const lunch  = emp.lunch_break_minutes
    const wdMin  = emp.workday_hours * 60

    const workedMin    = calcWorkedMinutesPeriod(recs, lunch)
    const overtimeMin  = recs.length ? (calcOvertimePeriod(recs, wdMin, lunch) ?? 0) : 0
    const days         = new Set(recs.map(r => r.date)).size

    const byDate = new Map<string, PunchRecord[]>()
    recs.forEach(r => { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date)!.push(r) })
    let incompleteDays = 0
    byDate.forEach(d => { if (isIncompleteDay(d)) incompleteDays++ })

    const earnings = emp.hourly_rate != null ? (workedMin / 60) * Number(emp.hourly_rate) : null

    empRows.push({ name: emp.name, workedMin, overtimeMin, earnings, days, incompleteDays })
    totalWorkedMin += workedMin
    if (earnings != null) totalEarnings += earnings

    if (emp.email && days > 0) {
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

// ── Vercel Cron (1st of each month at 08h) ────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runReport(prevMonthParams())
  return NextResponse.json(result)
}

// ── Manual trigger from admin panel ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { year?: unknown; month?: unknown }
  const reqYear  = body.year  != null ? Number(body.year)  : NaN
  const reqMonth = body.month != null ? Number(body.month) : NaN
  const hasValid = !isNaN(reqYear) && !isNaN(reqMonth) && reqMonth >= 1 && reqMonth <= 12 && reqYear >= 2020 && reqYear <= 2100
  const params: ReportParams = hasValid
    ? { year: reqYear, month: reqMonth }
    : prevMonthParams()

  const result = await runReport(params)
  return NextResponse.json(result)
}
