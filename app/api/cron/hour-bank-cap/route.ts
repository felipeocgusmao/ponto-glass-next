import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { activeTenantIds } from '@/lib/tenant'
import { getHourBankBalances } from '@/lib/data/hourBank'
import { recordCronRun } from '@/lib/cronHealth'
import webpush from 'web-push'
import type { TenantAlertSettings } from '../../tenant-settings/route'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

async function notifyAdmins(tenantId: string, notification: { title: string; body: string; url: string; tag: string }) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  const { data: admins } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin')
    .eq('active', true)

  if (!admins?.length) return

  const adminIds = admins.map((a: { id: string }) => a.id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('tenant_id', tenantId)
    .in('employee_id', adminIds)

  if (!subs?.length) return

  const payload = JSON.stringify(notification)
  await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription as webpush.PushSubscription, payload).catch(() => {})
    )
  )
}

async function runHourBankCap(tenantId: string): Promise<number> {
  const { data: tenant } = await supabase
    .from('tenants').select('alert_settings').eq('id', tenantId).maybeSingle()

  const settings = (tenant?.alert_settings ?? {}) as TenantAlertSettings & { hour_bank_max_positive?: number | null }
  const max = settings.hour_bank_max_positive
  if (!max || max <= 0) return 0

  // #289 — was reading a `hour_bank_balances` table that was never created;
  // the cap silently never fired. Now uses the same calc as /api/hour-bank.
  const balances = await getHourBankBalances(tenantId)

  const today = new Date().toISOString().split('T')[0]
  let capped = 0

  for (const [employeeId, balanceMin] of Object.entries(balances)) {
    if (balanceMin <= max) continue

    const excess = balanceMin - max
    const { error: insErr } = await supabase
      .from('hour_bank_adjustments')
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        minutes: -excess,
        reason: 'Cap automático de banco de horas',
        date: today,
      })

    if (insErr) continue

    const h = Math.floor(max / 60)
    const m = max % 60
    const label = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
    await notifyAdmins(tenantId, {
      title: 'Cap de banco de horas aplicado',
      body: `Banco de horas de um funcionário foi limitado a ${label}. Excesso de ${Math.floor(excess / 60)}h removido.`,
      url: '/admin',
      tag: `bank-cap-${today}`,
    })
    capped++
  }

  return capped
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantIds = await activeTenantIds()
  await recordCronRun('hour-bank-cap', tenantIds)

  let totalCapped = 0
  let failures = 0
  for (const tenantId of tenantIds) {
    try {
      totalCapped += await runHourBankCap(tenantId)
    } catch { failures++ }
  }
  return NextResponse.json({ capped: totalCapped, failures })
}
