import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to)
    return NextResponse.json({ error: 'Parâmetros from e to são obrigatórios' }, { status: 400 })

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(from) || !dateRegex.test(to))
    return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM-DD' }, { status: 400 })

  if (from > to)
    return NextResponse.json({ error: 'Data inicial não pode ser posterior à data final' }, { status: 400 })

  const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  if (diffDays > 366)
    return NextResponse.json({ error: 'Período máximo permitido é de 366 dias' }, { status: 400 })

  const employeeId = searchParams.get('employeeId')
  const MAX_ROWS = 2000

  let query = supabase
    .from('records')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('timestamp', { ascending: true })
    .limit(MAX_ROWS + 1)

  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const truncated = data.length > MAX_ROWS
  const records = truncated ? data.slice(0, MAX_ROWS) : data

  const res = NextResponse.json(records)
  if (truncated) res.headers.set('X-Truncated', 'true')
  return res
}
