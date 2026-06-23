import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { data, error } = await supabase
    .from('login_sessions')
    .select('id, ip, user_agent, created_at, revoked_at')
    .eq('employee_id', user.id)
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error?.code === '42P01') return NextResponse.json([])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function DELETE(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('login_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('employee_id', user.id)
    .eq('tenant_id', user.tenant_id)

  if (error?.code === '42P01') return NextResponse.json({ success: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
