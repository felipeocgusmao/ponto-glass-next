import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

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

  const { timestamp } = await request.json()
  const parsed = new Date(timestamp)
  if (!timestamp || isNaN(parsed.getTime()))
    return NextResponse.json({ error: 'Timestamp inválido' }, { status: 400 })

  const date = parsed.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('records')
    .update({ timestamp: parsed.toISOString(), date })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'record_update', { id: data.employee_id, name: data.employee_name }, {
    recordId: params.id, newTimestamp: parsed.toISOString(),
  })

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
