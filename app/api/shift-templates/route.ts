import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'
import { validateWeeklySchedule } from '@/lib/schedule'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })

  if (error?.code === '42P01') return NextResponse.json([])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { name, workday_hours, lunch_break_minutes, expected_start, expected_end, shift_start, weekly_schedule, works_holidays } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // #292 — optional full weekly schedule (same shape as employees.weekly_schedule).
  const wsError = validateWeeklySchedule(weekly_schedule ?? null)
  if (wsError) return NextResponse.json({ error: wsError }, { status: 400 })

  const { data, error } = await supabase
    .from('shift_templates')
    .insert({
      tenant_id: user.tenant_id,
      name,
      workday_hours: workday_hours ?? 8,
      lunch_break_minutes: lunch_break_minutes ?? 60,
      expected_start: expected_start || null,
      expected_end: expected_end || null,
      shift_start: shift_start || '00:00',
      weekly_schedule: weekly_schedule ?? null,
      works_holidays: Boolean(works_holidays),
    })
    .select()
    .single()

  if (error?.code === '42P01') return NextResponse.json({ error: 'Tabela não existe ainda' }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit(
    { id: user.id, name: user.name, tenant_id: user.tenant_id },
    'shift_template_create', { id: data.id, name: data.name }, { name }
  )

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('shift_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenant_id)

  if (error?.code === '42P01') return NextResponse.json({ success: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit(
    { id: user.id, name: user.name, tenant_id: user.tenant_id },
    'shift_template_delete', { id, name: '' }, { id }
  )

  return NextResponse.json({ success: true })
}
