import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate } from '@/lib/utils'
import webpush from 'web-push'

// Guard so a deploy without VAPID keys doesn't crash this module at load
// (web-push throws on an empty public key) — consistent with the other push routes.
if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  // Refuse outright when the secret is unset — otherwise the template literal
  // would accept the literal header "Bearer undefined".
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = businessDate()

  // Never flag absences on weekends.
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6) return NextResponse.json({ notified: 0, absent: 0, skipped: 'weekend' })

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')
    .eq('active', true)
    .eq('role', 'employee')

  if (!employees?.length) return NextResponse.json({ notified: 0 })

  // Skip holidays (company-wide when employee_id is null) and per-employee days off.
  const { data: exceptions } = await supabase
    .from('day_exceptions')
    .select('employee_id')
    .eq('date', today)
  if ((exceptions ?? []).some(e => !e.employee_id))
    return NextResponse.json({ notified: 0, absent: 0, skipped: 'holiday' })
  const offIds = new Set((exceptions ?? []).map(e => e.employee_id).filter(Boolean))

  const { data: entries } = await supabase
    .from('records')
    .select('employee_id')
    .eq('date', today)
    .eq('type', 'entrada')

  const presentIds = new Set((entries ?? []).map(r => r.employee_id))
  const absent = employees.filter(e => !presentIds.has(e.id) && !offIds.has(e.id))

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
    tag: `absence-${today}`,
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
