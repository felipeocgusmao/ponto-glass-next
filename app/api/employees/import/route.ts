import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { normalizeImportRows, MAX_IMPORT_ROWS } from '@/lib/employeeImport'
import { employeeLimitFor } from '@/lib/planLimits'

// Bulk-create employees from a parsed spreadsheet. The client parses the
// CSV/XLSX and sends raw row objects; ALL validation happens here again via
// the same lib the client used — the server never trusts the preview.
export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { rows?: Record<string, unknown>[] } | null
  if (!Array.isArray(body?.rows) || body.rows.length === 0)
    return NextResponse.json({ error: 'Nenhuma linha para importar' }, { status: 400 })
  // Cap keeps the request inside serverless time limits (bcrypt is ~100ms/row);
  // the client chunks bigger files.
  if (body.rows.length > MAX_IMPORT_ROWS)
    return NextResponse.json({ error: `Máximo de ${MAX_IMPORT_ROWS} linhas por pedido` }, { status: 400 })

  const results = normalizeImportRows(body.rows)
  const valid = results.filter(r => r.ok)
  const errors = results.filter(r => !r.ok).map(r => ({ row: r.row, error: (r as { error: string }).error }))

  if (valid.length) {
    // Plan limit (#251): the whole batch must fit within the remaining seats.
    const [{ data: tenant }, { count: activeCount }] = await Promise.all([
      supabase.from('tenants').select('plan').eq('id', user.tenant_id).maybeSingle(),
      supabase.from('employees').select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id).eq('active', true),
    ])
    const limit = employeeLimitFor(tenant?.plan)
    const remaining = limit - (activeCount ?? 0)
    if (valid.length > remaining)
      return NextResponse.json(
        { error: `Limite do plano: restam ${Math.max(0, remaining)} vaga(s) de ${limit}, mas a importação tem ${valid.length} funcionário(s) válido(s).` },
        { status: 403 },
      )

    // One round-trip to find usernames already taken in this tenant.
    const { data: existing } = await supabase
      .from('employees')
      .select('username')
      .eq('tenant_id', user.tenant_id)
      .in('username', valid.map(r => r.data.username))
    const taken = new Set((existing ?? []).map(e => e.username))

    for (const r of valid) {
      if (taken.has(r.data.username)) {
        errors.push({ row: r.row, error: `Usuário "${r.data.username}" já existe` })
        continue
      }
      const hash = await bcrypt.hash(r.data.password, 10)
      const { error } = await supabase.from('employees').insert({
        tenant_id: user.tenant_id,
        name: r.data.name,
        username: r.data.username,
        email: r.data.email,
        password_hash: hash,
        role: r.data.role,
        workday_hours: r.data.workday_hours,
        lunch_break_minutes: r.data.lunch_break_minutes,
        hourly_rate: r.data.hourly_rate,
      })
      if (error) errors.push({ row: r.row, error: error.message })
      else taken.add(r.data.username) // guards same-username rows across chunks
    }
  }

  const created = valid.length - errors.filter(e => valid.some(v => v.row === e.row)).length
  await logAudit(user, 'employee_import', null, { created, failed: errors.length, total: results.length })

  errors.sort((a, b) => a.row - b.row)
  return NextResponse.json({ created, errors }, { status: errors.length && !created ? 400 : 201 })
}
