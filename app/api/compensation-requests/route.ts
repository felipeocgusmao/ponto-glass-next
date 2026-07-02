import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'
import { businessDate } from '@/lib/utils'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (['admin', 'manager'].includes(user.role)) {
    // Admins see all requests for the tenant
    const { data, error } = await supabase
      .from('compensation_requests')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Employees see only their own
  const { data, error } = await supabase
    .from('compensation_requests')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })
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

  const body = await request.json().catch(() => ({})) as {
    date?: string
    hours_requested?: number
    reason?: string
  }

  // Error messages surface directly in the employee UI — keep them in pt.
  const { date, hours_requested, reason } = body
  if (!date || isNaN(new Date(date).getTime()))
    return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
  if (!hours_requested || hours_requested <= 0)
    return NextResponse.json({ error: 'As horas devem ser um valor positivo' }, { status: 400 })
  // Cap per request: an accidental (or malicious) 10 000h approved on a busy
  // day would credit the hour bank beyond repair. A day has at most 24h.
  if (hours_requested > 24)
    return NextResponse.json({ error: 'Máximo de 24 horas por pedido' }, { status: 400 })
  if (!reason?.trim())
    return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })
  if (date > businessDate())
    return NextResponse.json({ error: 'A data não pode ser no futuro' }, { status: 400 })

  const { data, error } = await supabase
    .from('compensation_requests')
    .insert({
      tenant_id: user.tenant_id,
      employee_id: user.id,
      employee_name: user.name,
      date,
      hours_requested,
      reason: reason.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'compensation_request_create' as any, null, { date, hours_requested })
  return NextResponse.json(data, { status: 201 })
}
