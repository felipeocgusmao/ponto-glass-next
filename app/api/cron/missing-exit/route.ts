import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate } from '@/lib/utils'
import webpush from 'web-push'

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
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6)
    return NextResponse.json({ notified: 0, missing: 0, skipped: 'weekend' })

  const { data: exceptions } = await supabase
    .from('day_exceptions').select('employee_id').eq('date', today)
  if ((exceptions ?? []).some(e => !e.employee_id))
    return NextResponse.json({ notified: 0, missing: 0, skipped: 'holiday' })

  const offIds = new Set((exceptions ?? []).map(e => e.employee_id).filter(Boolean))

  const { data: entries } = await supabase
    .from('records').select('employee_id, employee_name')
    .eq('date', today).eq('type', 'entrada')
  if (!entries?.length) return NextResponse.json({ notified: 0, missing: 0 })

  const enteredIds = Array.from(new Set(entries.map(r => r.employee_id)))
  const { data: exits } = await supabase
    .from('records').select('employee_id')
    .eq('date', today).eq('type', 'saída').in('employee_id', enteredIds)

  const exitedIds = new Set((exits ?? []).map(r => r.employee_id))
  const missing = entries
    .filter((r, i, self) => self.findIndex(x => x.employee_id === r.employee_id) === i)
    .filter(r => !exitedIds.has(r.employee_id) && !offIds.has(r.employee_id))

  if (!missing.length) return NextResponse.json({ notified: 0, missing: 0 })

  const { data: adminIds } = await supabase
    .from('employees').select('id').in('role', ['admin', 'manager']).eq('active', true)
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription')
    .in('employee_id', (adminIds ?? []).map(e => e.id))

  if (!subs?.length) return NextResponse.json({ notified: 0, missing: missing.length })

  const names = missing.map(e => e.employee_name).join(', ')
  const payload = JSON.stringify({
    title: 'Funcionários sem saída',
    body: missing.length === 1
      ? `${names} ainda não registou saída hoje.`
      : `${missing.length} funcionários sem saída: ${names}`,
    tag: `missing-exit-${today}`,
    url: '/admin',
  })

  let sent = 0
  await Promise.allSettled(
    (subs ?? []).map(async ({ subscription }) => {
      try {
        await webpush.sendNotification(subscription as webpush.PushSubscription, payload)
        sent++
      } catch { /* expired subscription */ }
    })
  )

  return NextResponse.json({ notified: sent, missing: missing.length })
}
