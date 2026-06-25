import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate } from '@/lib/utils'
import { activeTenantIds } from '@/lib/tenant'
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
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = businessDate()
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6)
    return NextResponse.json({ notified: 0, skipped: 'weekend' })

  let notified = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    try { notified += await runTenant(tenantId, today) }
    catch { failures++ }
  }

  return NextResponse.json({ notified, failures })
}

async function runTenant(tenantId: string, today: string): Promise<number> {
  // Find employees who have an entrada but no saída today
  const { data: entries } = await supabase
    .from('records')
    .select('employee_id, employee_name, timestamp')
    .eq('tenant_id', tenantId)
    .eq('date', today)
    .eq('type', 'entrada')

  if (!entries?.length) return 0

  const { data: exits } = await supabase
    .from('records')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('date', today)
    .eq('type', 'saída')

  const exitedIds = new Set((exits ?? []).map(r => r.employee_id))

  // Unique employees without exit
  const seen = new Set<string>()
  const stillWorking: { employee_id: string; employee_name: string; timestamp: string }[] = []
  for (const r of entries) {
    if (!seen.has(r.employee_id) && !exitedIds.has(r.employee_id)) {
      seen.add(r.employee_id)
      stillWorking.push(r)
    }
  }

  if (!stillWorking.length) return 0

  // Get push subscriptions for these employees
  const empIds = stillWorking.map(e => e.employee_id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, employee_id')
    .eq('tenant_id', tenantId)
    .in('employee_id', empIds)

  if (!subs?.length) return 0

  // Group subscriptions by employee
  const subsByEmp = new Map<string, webpush.PushSubscription[]>()
  for (const s of subs) {
    const arr = subsByEmp.get(s.employee_id) ?? []
    arr.push(s.subscription as webpush.PushSubscription)
    subsByEmp.set(s.employee_id, arr)
  }

  let sent = 0
  await Promise.allSettled(
    stillWorking.map(async emp => {
      const empSubs = subsByEmp.get(emp.employee_id)
      if (!empSubs?.length) return
      const payload = JSON.stringify({
        title: 'Não te esqueças de bater saída 🔔',
        body: 'O teu expediente está a terminar. Regista a saída para fechar o ponto.',
        url: '/ponto',
        tag: `punch-out-reminder-${today}`,
      })
      await Promise.allSettled(
        empSubs.map(sub =>
          webpush.sendNotification(sub, payload).then(() => { sent++ }).catch(() => {})
        )
      )
    })
  )

  return sent
}
