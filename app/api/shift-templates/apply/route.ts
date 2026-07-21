import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { templateId, employeeIds } = body as { templateId: string; employeeIds: string[] }

  if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  if (!Array.isArray(employeeIds) || employeeIds.length === 0)
    return NextResponse.json({ error: 'employeeIds must be a non-empty array' }, { status: 400 })

  const { data: template, error: tErr } = await supabase
    .from('shift_templates')
    .select('*')
    .eq('id', templateId)
    .eq('tenant_id', user.tenant_id)
    .maybeSingle()

  if (tErr?.code === '42P01') return NextResponse.json({ error: 'Tabela não existe ainda' }, { status: 503 })
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  const { error: updErr, count } = await supabase
    .from('employees')
    .update({
      workday_hours: template.workday_hours,
      lunch_break_minutes: template.lunch_break_minutes,
      expected_start: template.expected_start,
      expected_end: template.expected_end,
      shift_start: template.shift_start,
      // #292 — carries the full weekly schedule (folgas/horas por dia) and
      // works_holidays when the template has them; null clears any custom
      // per-employee schedule so the template becomes the single source.
      weekly_schedule: template.weekly_schedule ?? null,
      works_holidays: Boolean(template.works_holidays),
    })
    .eq('tenant_id', user.tenant_id)
    .in('id', employeeIds)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  logAudit(
    { id: user.id, name: user.name, tenant_id: user.tenant_id },
    'shift_template_apply', { id: templateId, name: template.name }, { employeeCount: employeeIds.length }
  )

  return NextResponse.json({ success: true, applied: count ?? employeeIds.length })
}
