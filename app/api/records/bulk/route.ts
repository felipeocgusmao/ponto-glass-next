import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'
import { isCsrfSafe } from '@/lib/csrf'

const VALID_TYPES = ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

interface BulkRecord { employeeId: string; type: string; timestamp: string }

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { records?: BulkRecord[] }
  const records = body.records
  if (!Array.isArray(records) || records.length === 0)
    return NextResponse.json({ error: 'records array required' }, { status: 400 })
  if (records.length > 500)
    return NextResponse.json({ error: 'Max 500 records per request' }, { status: 400 })

  // Validate all entries up front
  for (const r of records) {
    if (!r.employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
    if (!VALID_TYPES.includes(r.type)) return NextResponse.json({ error: `Invalid type: ${r.type}` }, { status: 400 })
    if (!r.timestamp || isNaN(new Date(r.timestamp).getTime()))
      return NextResponse.json({ error: `Invalid timestamp: ${r.timestamp}` }, { status: 400 })
  }

  // Fetch all unique employees referenced (must belong to the same tenant)
  const seen = new Set<string>()
  const uniqueEmpIds: string[] = []
  for (const r of records) { if (!seen.has(r.employeeId)) { seen.add(r.employeeId); uniqueEmpIds.push(r.employeeId) } }
  const { data: emps } = await supabase
    .from('employees').select('id, name, shift_start')
    .eq('tenant_id', user.tenant_id)
    .in('id', uniqueEmpIds)

  const empMap = new Map((emps ?? []).map(e => [e.id, e]))
  for (const id of uniqueEmpIds) {
    if (!empMap.has(id)) return NextResponse.json({ error: `Employee not found: ${id}` }, { status: 404 })
  }

  const rows = records.map(r => {
    const emp = empMap.get(r.employeeId)!
    const parsed = new Date(r.timestamp)
    const date = calcWorkDate(parsed, emp.shift_start ?? '00:00')
    return {
      tenant_id: user.tenant_id,
      employee_id: r.employeeId,
      employee_name: emp.name,
      type: r.type,
      timestamp: parsed.toISOString(),
      date,
    }
  })

  const { data, error } = await supabase.from('records').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'record_bulk_create', null, { count: rows.length, employeeIds: uniqueEmpIds })
  return NextResponse.json({ created: data?.length ?? rows.length }, { status: 201 })
}
