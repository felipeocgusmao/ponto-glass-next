import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'

const VALID_TYPES = ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const today = searchParams.get('today') === 'true'
  const date = searchParams.get('date')
  const employeeId = searchParams.get('employeeId')
  const isPrivileged = user.role === 'admin' || user.role === 'manager'

  let query = supabase.from('records').select('*').order('timestamp', { ascending: true })

  // Scope: a non-privileged user only sees themselves; an admin/manager sees a
  // specific employee when employeeId is given (and not 'all'), otherwise everyone.
  const singleEmpId = !isPrivileged
    ? user.id
    : (employeeId && employeeId !== 'all' ? employeeId : null)

  if (singleEmpId) query = query.eq('employee_id', singleEmpId)

  if (today) {
    // "Today" must mean the current *work date*, which is shift-aware: a night-shift
    // employee punching after midnight UTC is filed under the day the shift began.
    // Match how /api/punch dates records, or in-progress shifts vanish after midnight.
    if (singleEmpId) {
      const { data: emp } = await supabase
        .from('employees').select('shift_start').eq('id', singleEmpId).single()
      query = query.eq('date', calcWorkDate(new Date(), emp?.shift_start ?? '00:00'))
    } else {
      const { data: emps } = await supabase
        .from('employees').select('id, shift_start').eq('active', true)
      const now = new Date()
      const clauses = (emps ?? []).map(
        e => `and(employee_id.eq.${e.id},date.eq.${calcWorkDate(now, e.shift_start ?? '00:00')})`
      )
      if (clauses.length === 0) return NextResponse.json([])
      query = query.or(clauses.join(','))
    }
  } else if (date) {
    query = query.eq('date', date)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employeeId, type, timestamp } = await request.json()

  if (!VALID_TYPES.includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const parsed = new Date(timestamp)
  if (!timestamp || isNaN(parsed.getTime()))
    return NextResponse.json({ error: 'Timestamp inválido' }, { status: 400 })

  if (!employeeId)
    return NextResponse.json({ error: 'Funcionário obrigatório' }, { status: 400 })

  const { data: emp } = await supabase
    .from('employees').select('name, shift_start').eq('id', employeeId).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const date = calcWorkDate(parsed, emp.shift_start ?? '00:00')

  const { data, error } = await supabase
    .from('records')
    .insert({ employee_id: employeeId, employee_name: emp.name, type, timestamp: parsed.toISOString(), date })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'record_create', { id: employeeId, name: emp.name }, { type, date })
  return NextResponse.json(data, { status: 201 })
}
