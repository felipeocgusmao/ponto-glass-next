import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'

// GET: list approvals for a week or employee
export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const weekStart  = searchParams.get('weekStart')
  const employeeId = searchParams.get('employeeId')

  let q = supabase
    .from('timesheet_approvals')
    .select('id, employee_id, week_start, approved_by_name, created_at')
    .eq('tenant_id', user.tenant_id)

  if (weekStart)  q = q.eq('week_start', weekStart)
  if (employeeId) q = q.eq('employee_id', employeeId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) {
    // Table does not exist yet — return empty list gracefully
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST: approve a week for an employee
export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { employeeId?: unknown; weekStart?: unknown }
  const employeeId = String(body.employeeId ?? '')
  const weekStart  = String(body.weekStart ?? '')

  if (!employeeId || !weekStart)
    return NextResponse.json({ error: 'employeeId e weekStart são obrigatórios' }, { status: 400 })

  // Verify employee belongs to same tenant
  const { data: emp } = await supabase
    .from('employees').select('id').eq('tenant_id', user.tenant_id).eq('id', employeeId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('timesheet_approvals')
    .upsert(
      { tenant_id: user.tenant_id, employee_id: employeeId, week_start: weekStart, approved_by_name: user.name },
      { onConflict: 'tenant_id,employee_id,week_start' }
    )
    .select().single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Funcionalidade ainda não configurada. Execute a migração da base de dados.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE: revoke an approval
export async function DELETE(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('timesheet_approvals')
    .delete()
    .eq('tenant_id', user.tenant_id)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
