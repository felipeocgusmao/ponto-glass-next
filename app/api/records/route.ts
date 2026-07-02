import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'
import { isValidPunchType } from '@/lib/punchValidation'
import { getTodayRecordsForEmployee, getTodayRecordsAllEmployees } from '@/lib/data/records'

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const today = searchParams.get('today') === 'true'
  const date = searchParams.get('date')
  const employeeId = searchParams.get('employeeId')
  const isPrivileged = user.role === 'admin' || user.role === 'manager'

  let query = supabase.from('records').select('*')
    .eq('tenant_id', user.tenant_id)
    .order('timestamp', { ascending: true })

  // Scope: a non-privileged user only sees themselves; an admin/manager sees a
  // specific employee when employeeId is given (and not 'all'), otherwise everyone.
  const singleEmpId = !isPrivileged
    ? user.id
    : (employeeId && employeeId !== 'all' ? employeeId : null)

  // Single-employee "today" is the hot path (an employee viewing their own day, or
  // an admin viewing one person) — served by the shared, shift-aware helper that
  // Server Components also use, so the math stays in one place.
  if (today && singleEmpId) {
    return NextResponse.json(
      await getTodayRecordsForEmployee(user, singleEmpId),
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // "Today" across all employees (privileged, no employeeId) — shared helper.
  if (today) {
    return NextResponse.json(
      await getTodayRecordsAllEmployees(user),
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Non-today path: scope to the single employee (always, for non-privileged
  // users) and to a specific date when given.
  if (singleEmpId) query = query.eq('employee_id', singleEmpId)
  if (date) query = query.eq('date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
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

  const { employeeId, type, timestamp } = await request.json()

  if (!isValidPunchType(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const parsed = new Date(timestamp)
  if (!timestamp || isNaN(parsed.getTime()))
    return NextResponse.json({ error: 'Timestamp inválido' }, { status: 400 })

  if (!employeeId)
    return NextResponse.json({ error: 'Funcionário obrigatório' }, { status: 400 })

  // The target employee must live in the actor's tenant — protects against
  // an admin in tenant A punching for someone in tenant B.
  const { data: emp } = await supabase
    .from('employees').select('name, shift_start')
    .eq('tenant_id', user.tenant_id).eq('id', employeeId).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const date = calcWorkDate(parsed, emp.shift_start ?? '00:00')

  const { data, error } = await supabase
    .from('records')
    .insert({ tenant_id: user.tenant_id, employee_id: employeeId, employee_name: emp.name, type, timestamp: parsed.toISOString(), date })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'record_create', { id: employeeId, name: emp.name }, { type, date })
  return NextResponse.json(data, { status: 201 })
}
