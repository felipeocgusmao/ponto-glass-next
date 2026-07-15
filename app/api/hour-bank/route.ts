import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcDayRounded, businessDate } from '@/lib/utils'
import { targetMinutesForDate } from '@/lib/schedule'
import type { PunchRecord } from '@/lib/types'

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const isPrivileged = ['admin', 'manager'].includes(user.role)

  // Bulk mode: returns { [employeeId]: balanceMin } for all employees in 3 queries.
  if (searchParams.get('all') === 'true') {
    if (!isPrivileged) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const today = businessDate()

    const [{ data: emps }, { data: records }, { data: adjustments }] = await Promise.all([
      supabase.from('employees').select('id, workday_hours, lunch_break_minutes, weekly_schedule')
        .eq('tenant_id', user.tenant_id).eq('active', true),
      supabase.from('records').select('*')
        .eq('tenant_id', user.tenant_id)
        .lt('date', today).order('timestamp', { ascending: true }),
      supabase.from('hour_bank_adjustments').select('employee_id, minutes')
        .eq('tenant_id', user.tenant_id),
    ])

    const empMap = new Map((emps ?? []).map(e => [e.id, e]))

    // Group records by employee → date
    const byEmpDay = new Map<string, Map<string, PunchRecord[]>>()
    for (const r of (records ?? []) as PunchRecord[]) {
      if (!byEmpDay.has(r.employee_id)) byEmpDay.set(r.employee_id, new Map())
      const dm = byEmpDay.get(r.employee_id)!
      if (!dm.has(r.date)) dm.set(r.date, [])
      dm.get(r.date)!.push(r)
    }

    // Sum adjustments per employee
    const adjByEmp = new Map<string, number>()
    for (const a of (adjustments ?? []) as { employee_id: string; minutes: number }[]) {
      adjByEmp.set(a.employee_id, (adjByEmp.get(a.employee_id) ?? 0) + a.minutes)
    }

    const balances: Record<string, number> = {}
    empMap.forEach((emp, empId) => {
      const lunchMin = emp.lunch_break_minutes
      let raw = 0
      byEmpDay.get(empId)?.forEach((dayRecs, date) => {
        if (!dayRecs.some(r => r.type === 'saída')) return
        // Per-weekday target (#287): a 7h Saturday debits 7h, not the weekday 8h30.
        raw += calcDayRounded(dayRecs, lunchMin) - targetMinutesForDate(emp, date)
      })
      balances[empId] = Math.round(raw + (adjByEmp.get(empId) ?? 0))
    })

    return NextResponse.json(balances, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    })
  }

  // Single-employee mode (original behaviour)
  const empId = searchParams.get('employeeId') ?? user.id

  if (empId !== user.id && !isPrivileged)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: emp } = await supabase
    .from('employees')
    .select('workday_hours, lunch_break_minutes, weekly_schedule')
    .eq('tenant_id', user.tenant_id)
    .eq('id', empId)
    .single()

  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const today = businessDate()

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', empId)
    .lt('date', today)
    .order('timestamp', { ascending: true })

  const byDay = new Map<string, PunchRecord[]>()
  ;(records ?? []).forEach((r: PunchRecord) => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })

  const lunchMin = emp.lunch_break_minutes
  let rawBalanceMin = 0

  byDay.forEach((dayRecs, date) => {
    if (!dayRecs.some(r => r.type === 'saída')) return
    // Hour bank operates on the *rounded* (centesimal-friendly) daily total so the
    // balance the employee sees matches the value printed on holerites/relatórios.
    // Target is per-weekday (#287) so short Saturdays don't read as negative.
    rawBalanceMin += calcDayRounded(dayRecs, lunchMin) - targetMinutesForDate(emp, date)
  })

  const { data: adjustments } = await supabase
    .from('hour_bank_adjustments')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', empId)
    .order('date', { ascending: false })

  const adjustmentsTotal = (adjustments ?? []).reduce((s: number, a: { minutes: number }) => s + a.minutes, 0)
  return NextResponse.json({
    balanceMin: Math.round(rawBalanceMin + adjustmentsTotal),
    adjustments: isPrivileged ? (adjustments ?? []) : [],
  }, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employeeId, minutes, reason, date } = await request.json()

  if (!employeeId || minutes === undefined || !reason)
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  const parsedMinutes = Number(minutes)
  if (isNaN(parsedMinutes) || Math.abs(parsedMinutes) > 1440)
    return NextResponse.json({ error: 'Minutos inválidos (máx. ±1440)' }, { status: 400 })

  const { data: emp } = await supabase.from('employees').select('name')
    .eq('tenant_id', user.tenant_id).eq('id', employeeId).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('hour_bank_adjustments')
    .insert({
      tenant_id: user.tenant_id,
      employee_id: employeeId,
      minutes: parsedMinutes,
      reason: String(reason).trim(),
      date: date ?? businessDate(),
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'hour_bank_adjustment', { id: employeeId, name: emp.name }, {
    minutes: parsedMinutes, reason,
  })

  return NextResponse.json(data, { status: 201 })
}
