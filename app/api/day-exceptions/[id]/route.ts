import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

async function requirePrivileged() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return ['admin', 'manager'].includes(user.role) ? user : null
  } catch { return null }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requirePrivileged()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: exc } = await supabase
    .from('day_exceptions')
    .select('date, description')
    .eq('tenant_id', actor.tenant_id)
    .eq('id', params.id)
    .single()

  if (!exc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { error } = await supabase.from('day_exceptions').delete()
    .eq('tenant_id', actor.tenant_id).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, 'day_exception_delete', null, { date: exc.date, description: exc.description })
  return NextResponse.json({ success: true })
}
