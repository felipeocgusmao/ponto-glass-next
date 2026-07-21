import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { businessDate } from '@/lib/utils'
import { getHourBankBalances, getHourBankBalance } from '@/lib/data/hourBank'

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

    const balances = await getHourBankBalances(user.tenant_id)
    return NextResponse.json(balances, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    })
  }

  // Single-employee mode (original behaviour)
  const empId = searchParams.get('employeeId') ?? user.id

  if (empId !== user.id && !isPrivileged)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const balanceMin = await getHourBankBalance(user.tenant_id, empId)
  if (balanceMin === null) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const { data: adjustments } = await supabase
    .from('hour_bank_adjustments')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', empId)
    .order('date', { ascending: false })

  return NextResponse.json({
    balanceMin,
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
