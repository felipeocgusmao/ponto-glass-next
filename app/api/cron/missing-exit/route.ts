import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate, businessHourOfDay } from '@/lib/utils'
import { activeTenantIds } from '@/lib/tenant'
import webpush from 'web-push'

// Late-evening local hour: after every schedule's expected end (incl. 19:30
// exits), before midnight rolls the business day. Dual UTC hours in vercel.json
// + this guard keep it DST-stable (#286).
const TARGET_LOCAL_HOUR = 21

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

  if (businessHourOfDay() !== TARGET_LOCAL_HOUR)
    return NextResponse.json({ notified: 0, missing: 0, skipped: 'off-hour' })

  // Runs every day (#287): whoever clocked in — weekend or holiday — and has no
  // clock-out deserves the admin heads-up; people who didn't work have no entrada.
  const today = businessDate()

  // One pass per active tenant; holidays and notifications are per-company.
  let notified = 0
  let missingTotal = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    // One tenant erroring must not starve the remaining tenants.
    try {
      const r = await runTenant(tenantId, today)
      notified += r.notified
      missingTotal += r.missing
    } catch { failures++ }
  }

  return NextResponse.json({ notified, missing: missingTotal, failures })
}

async function runTenant(tenantId: string, today: string): Promise<{ notified: number; missing: number }> {
  // Per-employee day off still spares that person; a company-wide holiday no
  // longer short-circuits the tenant — anyone who actually punched in on the
  // holiday (works_holidays crew) still gets checked (#287).
  const { data: exceptions } = await supabase
    .from('day_exceptions').select('employee_id')
    .eq('tenant_id', tenantId).eq('date', today)
  const offIds = new Set((exceptions ?? []).map(e => e.employee_id).filter(Boolean))

  const { data: entries } = await supabase
    .from('records').select('employee_id, employee_name')
    .eq('tenant_id', tenantId).eq('date', today).eq('type', 'entrada')
  if (!entries?.length) return { notified: 0, missing: 0 }

  const enteredIds = Array.from(new Set(entries.map(r => r.employee_id)))
  const { data: exits } = await supabase
    .from('records').select('employee_id')
    .eq('tenant_id', tenantId).eq('date', today).eq('type', 'saída').in('employee_id', enteredIds)

  const exitedIds = new Set((exits ?? []).map(r => r.employee_id))
  const missing = entries
    .filter((r, i, self) => self.findIndex(x => x.employee_id === r.employee_id) === i)
    .filter(r => !exitedIds.has(r.employee_id) && !offIds.has(r.employee_id))

  if (!missing.length) return { notified: 0, missing: 0 }

  const { data: adminIds } = await supabase
    .from('employees').select('id')
    .eq('tenant_id', tenantId).in('role', ['admin', 'manager']).eq('active', true)
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription')
    .eq('tenant_id', tenantId).in('employee_id', (adminIds ?? []).map(e => e.id))

  if (!subs?.length) return { notified: 0, missing: missing.length }

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

  return { notified: sent, missing: missing.length }
}
