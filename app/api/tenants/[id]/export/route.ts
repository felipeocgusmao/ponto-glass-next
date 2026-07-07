import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, created_at')
    .eq('id', params.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const [employees, records, corrections, hourBank, dayExceptions, auditLogs] = await Promise.all([
    supabase.from('employees')
      .select('id, name, username, email, role, active, workday_hours, lunch_break_minutes, created_at')
      .eq('tenant_id', params.id).order('created_at'),
    supabase.from('records')
      .select('id, employee_id, employee_name, type, timestamp, date')
      .eq('tenant_id', params.id).order('timestamp'),
    supabase.from('correction_requests')
      .select('*').eq('tenant_id', params.id).order('created_at'),
    supabase.from('hour_bank_adjustments')
      .select('*').eq('tenant_id', params.id).order('date'),
    supabase.from('day_exceptions')
      .select('*').eq('tenant_id', params.id).order('date'),
    supabase.from('audit_logs')
      .select('actor_name, action, target_name, details, created_at')
      .eq('tenant_id', params.id).order('created_at', { ascending: false }).limit(1000),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    exported_by: actor.username,
    tenant,
    employees: employees.data ?? [],
    records: records.data ?? [],
    correction_requests: corrections.data ?? [],
    hour_bank_adjustments: hourBank.data ?? [],
    day_exceptions: dayExceptions.data ?? [],
    audit_logs: auditLogs.data ?? [],
  }

  await logAudit(actor, 'super_admin_export', { id: params.id, name: tenant.name }, {
    record_count: (records.data ?? []).length,
    employee_count: (employees.data ?? []).length,
  })

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="export-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
