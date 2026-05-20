import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

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

  if (!isPrivileged) {
    query = query.eq('employee_id', user.id)
  } else if (employeeId && employeeId !== 'all') {
    query = query.eq('employee_id', employeeId)
  }

  if (today) {
    query = query.eq('date', new Date().toISOString().split('T')[0])
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
    .from('employees').select('name').eq('id', employeeId).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const date = parsed.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('records')
    .insert({ employee_id: employeeId, employee_name: emp.name, type, timestamp: parsed.toISOString(), date })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'record_create', { id: employeeId, name: emp.name }, { type, date })
  return NextResponse.json(data, { status: 201 })
}
