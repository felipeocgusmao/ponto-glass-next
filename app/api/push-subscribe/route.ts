import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'

// Accepts both Web Push subscriptions (web) and native device tokens (iOS/Android).
// The stored payload shape:
//   Web:    { endpoint, keys: { p256dh, auth } }  ← standard PushSubscriptionJSON
//   Native: { native: true, token: string, platform: 'ios' | 'android' }

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const body = await request.json()

  // Native token from @capacitor/push-notifications
  if (body?.kind === 'native') {
    if (!body.token || !['ios', 'android'].includes(body.platform))
      return NextResponse.json({ error: 'Invalid native token' }, { status: 400 })
    const subscription = { native: true, token: body.token, platform: body.platform }
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ employee_id: user.id, subscription }, { onConflict: 'employee_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Web Push subscription (standard PushSubscriptionJSON)
  if (!body?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ employee_id: user.id, subscription: body }, { onConflict: 'employee_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  await supabase.from('push_subscriptions').delete().eq('employee_id', user.id)
  return NextResponse.json({ ok: true })
}
