import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate, businessHourOfDay } from '@/lib/utils'
import { isScheduledWorkday } from '@/lib/schedule'
import { activeTenantIds } from '@/lib/tenant'
import webpush from 'web-push'

// The cron fires at two UTC hours (vercel.json) so one of them always lands on
// this LOCAL hour, summer or winter time (#286).
const TARGET_LOCAL_HOUR = 10

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

  if (businessHourOfDay() !== TARGET_LOCAL_HOUR)
    return NextResponse.json({ notified: 0, absent: 0, skipped: 'off-hour' })

  const today = businessDate()
  // No global weekend skip (#287): weekend workers are checked on their working
  // days; everyone else is excluded per-employee by isScheduledWorkday below.

  // One pass per active tenant; each company gets its own holiday calendar,
  // employee list and admin notifications.
  let notified = 0
  let absentTotal = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    // One tenant erroring (DB hiccup, bad subscription payload) must not
    // starve the remaining tenants of their notifications.
    try {
      const r = await runTenant(tenantId, today)
      notified += r.notified
      absentTotal += r.absent
    } catch { failures++ }
  }

  return NextResponse.json({ notified, absent: absentTotal, failures })
}

async function runTenant(tenantId: string, today: string): Promise<{ notified: number; absent: number }> {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, workday_hours, expected_start, expected_end, weekly_schedule, works_holidays')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('role', 'employee')

  if (!employees?.length) return { notified: 0, absent: 0 }

  // Company-wide holiday (employee_id null) only spares people who don't work
  // holidays (#287); per-employee day_exceptions spare that person either way.
  const { data: exceptions } = await supabase
    .from('day_exceptions')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('date', today)
  const companyHoliday = (exceptions ?? []).some(e => !e.employee_id)
  const offIds = new Set((exceptions ?? []).map(e => e.employee_id).filter(Boolean))

  const { data: entries } = await supabase
    .from('records')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('date', today)
    .eq('type', 'entrada')

  const presentIds = new Set((entries ?? []).map(r => r.employee_id))
  const absent = employees.filter(e =>
    !presentIds.has(e.id) &&
    !offIds.has(e.id) &&
    isScheduledWorkday(e, today) &&
    (!companyHoliday || e.works_holidays === true)
  )

  if (!absent.length) return { notified: 0, absent: 0 }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, employee_id')
    .eq('tenant_id', tenantId)
    .in('employee_id', await getAdminIds(tenantId))

  if (!subs?.length) return { notified: 0, absent: absent.length }

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

  return { notified: sent, absent: absent.length }
}

async function getAdminIds(tenantId: string): Promise<string[]> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'manager'])
    .eq('active', true)
  return (data ?? []).map(e => e.id)
}
