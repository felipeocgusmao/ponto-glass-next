import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', user.id)

  if (!subs?.length)
    return NextResponse.json({ error: 'no_subscription' }, { status: 404 })

  const payload = JSON.stringify({
    title: 'PontoGlass · Teste',
    body: 'As notificações push estão a funcionar correctamente.',
    url: '/admin',
    tag: 'test-notification',
  })

  const results = await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription as webpush.PushSubscription, payload)
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  if (sent === 0) return NextResponse.json({ error: 'Failed to send' }, { status: 502 })
  return NextResponse.json({ sent })
}
