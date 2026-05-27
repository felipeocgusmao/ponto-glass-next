import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: adj } = await supabase
    .from('hour_bank_adjustments')
    .select('employee_id, minutes, reason')
    .eq('id', params.id)
    .single()

  if (!adj) return NextResponse.json({ error: 'Ajuste não encontrado' }, { status: 404 })

  const { data: emp } = await supabase
    .from('employees')
    .select('name')
    .eq('id', adj.employee_id)
    .single()

  const { error } = await supabase.from('hour_bank_adjustments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'hour_bank_adjustment_delete',
    emp ? { id: adj.employee_id, name: emp.name } : null,
    { minutes: adj.minutes, reason: adj.reason }
  )

  return NextResponse.json({ success: true })
}
