import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'

const DEFAULT_PAGE_SIZE = 500
const MAX_PAGE_SIZE = 2000

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const isPrivileged = ['admin', 'manager'].includes(user.role)

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

  const requestedId = searchParams.get('employeeId')
  // Employees can only query their own records
  if (!isPrivileged && requestedId && requestedId !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const employeeId = isPrivileged ? requestedId : user.id

  // Pagination: page is 1-based, limit is capped at MAX_PAGE_SIZE.
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * limit

  let query = supabase
    .from('records')
    .select('*', { count: 'exact' })
    .eq('tenant_id', user.tenant_id)
    .gte('date', from)
    .lte('date', to)
    .order('timestamp', { ascending: true })
    .range(offset, offset + limit - 1)

  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json(
    { data, pagination: { page, limit, total, totalPages } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
