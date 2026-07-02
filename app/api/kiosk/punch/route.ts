import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcWorkDate } from '@/lib/utils'
import { isCsrfSafe } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { isValidPunchType, isDuplicatePunch } from '@/lib/punchValidation'
import { logAudit } from '@/lib/audit'

// Public endpoint: punches an employee from the shared kiosk tablet.
// No session cookie required — the tenant's kiosk_token IS the authentication
// (an admin generates/revokes it in Integrações; middleware lets this path through).
export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as {
    token?: string
    employee_id?: string
    type?: string
  }

  const { token, employee_id, type } = body
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })
  if (!isValidPunchType(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  // Resolve tenant from kiosk token
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('kiosk_token', token)
    .eq('active', true)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Verify employee belongs to tenant
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, shift_start')
    .eq('id', employee_id)
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .maybeSingle()

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const rl = await checkRateLimit(`kiosk-punch:${employee.id}`, 10, 60_000)
  if (!rl.allowed)
    return NextResponse.json({ error: 'Muitos registos seguidos. Aguarde um momento.' }, { status: 429 })

  const timestamp = new Date()
  const date = calcWorkDate(timestamp, employee.shift_start ?? '00:00')

  // Same double-tap guard as /api/punch and /api/qr/punch — a shared tablet is
  // the most double-tap-prone surface of the three.
  const { data: lastRec } = await supabase
    .from('records').select('type, timestamp')
    .eq('tenant_id', tenant.id)
    .eq('employee_id', employee.id)
    .order('timestamp', { ascending: false })
    .limit(1).maybeSingle()

  if (isDuplicatePunch(lastRec?.type, lastRec?.timestamp, type, timestamp))
    return NextResponse.json({ error: 'Registo duplicado. Aguarde um momento.' }, { status: 409 })

  const { data, error } = await supabase
    .from('records')
    .insert({
      tenant_id: tenant.id,
      employee_id: employee.id,
      employee_name: employee.name,
      type,
      timestamp: timestamp.toISOString(),
      date,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(
    { id: employee.id, name: employee.name, tenant_id: tenant.id },
    'punch_kiosk',
    { id: employee.id, name: employee.name },
    { type },
  )

  return NextResponse.json(data, { status: 201 })
}
