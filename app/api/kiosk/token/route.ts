import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('tenants')
    .select('kiosk_token')
    .eq('id', user.tenant_id)
    .single()

  return NextResponse.json({ kiosk_token: data?.kiosk_token ?? null })
}

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const newToken = crypto.randomUUID()
  const { error } = await supabase
    .from('tenants')
    .update({ kiosk_token: newToken })
    .eq('id', user.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'kiosk_token_regenerate' as any, null, {})
  return NextResponse.json({ kiosk_token: newToken }, { status: 201 })
}
