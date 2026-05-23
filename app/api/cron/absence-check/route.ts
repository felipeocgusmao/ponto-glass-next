import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@pontoglass.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayUtc = new Date().toISOString().split('T')[0]

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')
    .eq('active', true)
    .eq('role', 'employee')

  if (!employees?.length) return NextResponse.json({ notified: 0 })

  const { data: entries } = await supabase
    .from('records')
    .select('employee_id')
    .eq('date', todayUtc)
    .eq('type', 'entrada')

  const presentIds = new Set((entries ?? []).map(r => r.employee_id))
  const absent = employees.filter(e => !presentIds.has(e.id))

  if (!absent.length) return NextResponse.json({ notified: 0, absent: 0 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, employee_id')
    .in('employee_id', await getAdminIds())

  if (!subs?.length) return NextResponse.json({ notified: 0, absent: absent.length })

  const names = absent.map(e => e.name).join(', ')
  const payload = JSON.stringify({
    title: 'Funcionários sem entrada',
    body: absent.length === 1
      ? `${names} ainda não registou entrada hoje.`
      : `${absent.length} funcionários sem entrada: ${names}`,
    tag: `absence-${todayUtc}`,
    url: '/admin',
  })

  let sent = 0
  await Promise.allSettled(
    subs.map(async ({ subscription }) => {
      try {
        await webpush.sendNotification(subscription as webpush.PushSubscription, payload)
        sent++
      } catch { /* subscription may be expired */ }
    })
  )

  return NextResponse.json({ notified: sent, absent: absent.length })
}

async function getAdminIds(): Promise<string[]> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .in('role', ['admin', 'manager'])
    .eq('active', true)
  return (data ?? []).map(e => e.id)
}
