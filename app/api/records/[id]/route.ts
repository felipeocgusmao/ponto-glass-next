import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.timestamp !== undefined) {
    const parsed = new Date(body.timestamp)
    if (!body.timestamp || isNaN(parsed.getTime()))
      return NextResponse.json({ error: 'Timestamp inválido' }, { status: 400 })
    // Re-derive the work date in the business timezone, honouring the employee's shift,
    // so an edited punch stays filed under the day it was actually worked.
    const { data: rec } = await supabase
      .from('records').select('employee_id').eq('id', params.id).single()
    const { data: emp } = rec
      ? await supabase.from('employees').select('shift_start').eq('id', rec.employee_id).maybeSingle()
      : { data: null }
    updates.timestamp = parsed.toISOString()
    updates.date = calcWorkDate(parsed, emp?.shift_start ?? '00:00')
  }

  if (body.comment !== undefined) {
    updates.comment = body.comment ? String(body.comment).slice(0, 500) : null
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('records')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const auditDetails: Record<string, unknown> = { recordId: params.id }
  if (updates.timestamp) auditDetails.newTimestamp = updates.timestamp
  if (updates.comment !== undefined) auditDetails.comment = updates.comment
  await logAudit(user, 'record_update', { id: data.employee_id, name: data.employee_name }, auditDetails)

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rec } = await supabase
    .from('records').select('employee_id, employee_name, type, date').eq('id', params.id).single()

  const { error } = await supabase.from('records').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (rec) {
    await logAudit(user, 'record_delete', { id: rec.employee_id, name: rec.employee_name }, {
      recordId: params.id, type: rec.type, date: rec.date,
    })
  }

  return NextResponse.json({ success: true })
}
