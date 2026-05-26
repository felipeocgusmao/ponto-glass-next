import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcNetMinutes, businessDate } from '@/lib/utils'
import type { PunchRecord } from '@/lib/types'

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const empId = searchParams.get('employeeId') ?? user.id
  const isPrivileged = ['admin', 'manager'].includes(user.role)

  if (empId !== user.id && !isPrivileged)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: emp } = await supabase
    .from('employees')
    .select('workday_hours, lunch_break_minutes')
    .eq('id', empId)
    .single()

  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const today = businessDate()

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('employee_id', empId)
    .lt('date', today)
    .order('timestamp', { ascending: true })

  const byDay = new Map<string, PunchRecord[]>()
  ;(records ?? []).forEach((r: PunchRecord) => {
    if (!byDay.has(r.date)) byDay.set(r.date, [])
    byDay.get(r.date)!.push(r)
  })

  const workdayMin = emp.workday_hours * 60
  const lunchMin = emp.lunch_break_minutes
  let rawBalanceMin = 0

  byDay.forEach((dayRecs) => {
    if (!dayRecs.some(r => r.type === 'saída')) return
    rawBalanceMin += calcNetMinutes(dayRecs, lunchMin) - workdayMin
  })

  const { data: adjustments } = await supabase
    .from('hour_bank_adjustments')
    .select('*')
    .eq('employee_id', empId)
    .order('date', { ascending: false })

  const adjustmentsTotal = (adjustments ?? []).reduce((s: number, a: { minutes: number }) => s + a.minutes, 0)
  return NextResponse.json({
    balanceMin: Math.round(rawBalanceMin + adjustmentsTotal),
    adjustments: isPrivileged ? (adjustments ?? []) : [],
  })
}

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employeeId, minutes, reason, date } = await request.json()

  if (!employeeId || minutes === undefined || !reason)
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  const parsedMinutes = Number(minutes)
  if (isNaN(parsedMinutes) || Math.abs(parsedMinutes) > 1440)
    return NextResponse.json({ error: 'Minutos inválidos (máx. ±1440)' }, { status: 400 })

  const { data: emp } = await supabase.from('employees').select('name').eq('id', employeeId).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('hour_bank_adjustments')
    .insert({
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
