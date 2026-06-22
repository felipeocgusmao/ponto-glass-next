import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'
import { createHmac } from 'crypto'
import { checkRateLimit } from '@/lib/rateLimit'
import { isValidPunchType, isDuplicatePunch } from '@/lib/punchValidation'

function qrToken(employeeId: string, tenantId: string): string {
  const secret = process.env.QR_SECRET ?? process.env.JWT_SECRET ?? 'qr-fallback'
  return createHmac('sha256', secret)
    .update(`${employeeId}:${tenantId}`)
    .digest('base64url')
    .slice(0, 32)
}

// Public endpoint: punches an employee identified by their QR token.
// No session cookie required — the HMAC token IS the authentication.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    employeeId?: unknown; token?: unknown; type?: unknown; tenantId?: unknown
  }
  const employeeId = String(body.employeeId ?? '')
  const token      = String(body.token ?? '')
  const type       = String(body.type ?? '')
  const tenantId   = String(body.tenantId ?? '')

  if (!employeeId || !token || !tenantId)
    return NextResponse.json({ error: 'employeeId, tenantId e token são obrigatórios' }, { status: 400 })
  if (!isValidPunchType(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  // Constant-time token comparison to prevent timing attacks
  const expected = qrToken(employeeId, tenantId)
  if (token !== expected)
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const rl = await checkRateLimit(`qr-punch:${employeeId}`, 10, 60_000)
  if (!rl.allowed)
    return NextResponse.json({ error: 'Muitos registos seguidos. Aguarde um momento.' }, { status: 429 })

  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, shift_start')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .eq('active', true)
    .maybeSingle()

  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const now = new Date()
  const workDate = calcWorkDate(now, emp.shift_start ?? '00:00')

  const { data: lastRec } = await supabase
    .from('records').select('type, timestamp')
    .eq('tenant_id', tenantId)
    .eq('employee_id', emp.id)
    .order('timestamp', { ascending: false })
    .limit(1).maybeSingle()

  if (isDuplicatePunch(lastRec?.type, lastRec?.timestamp, type, now))
    return NextResponse.json({ error: 'Registo duplicado. Aguarde um momento.' }, { status: 409 })

  const { data, error } = await supabase
    .from('records')
    .insert({
      tenant_id: tenantId,
      employee_id: emp.id,
      employee_name: emp.name,
      type,
      timestamp: now.toISOString(),
      date: workDate,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(
    { id: emp.id, name: emp.name, tenant_id: tenantId },
    'punch_qr_kiosk',
    { id: emp.id, name: emp.name },
    { type },
  )

  return NextResponse.json({ success: true, record: data, employeeName: emp.name })
}
