import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { activeTenantIds } from '@/lib/tenant'
import webpush from 'web-push'
import type { TenantAlertSettings } from '../../tenant-settings/route'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

async function runAlertCheck(tenantId: string) {
  const { data: tenant } = await supabase
    .from('tenants').select('alert_settings').eq('id', tenantId).maybeSingle()
  const settings = (tenant?.alert_settings ?? {}) as TenantAlertSettings
  if (!settings.hour_bank_low_threshold && !settings.long_day_threshold) return 0

  const today = new Date().toISOString().split('T')[0]
  let alertCount = 0

  // Check hour bank low threshold
  if (settings.hour_bank_low_threshold !== null) {
    const threshold = settings.hour_bank_low_threshold

    const { data: balances } = await supabase
      .from('hour_bank_balances')
      .select('employee_id, balance_minutes')
      .eq('tenant_id', tenantId)

    for (const row of (balances ?? []) as { employee_id: string; balance_minutes: number }[]) {
      if (row.balance_minutes <= threshold) {
        const h = Math.abs(Math.floor(row.balance_minutes / 60))
        const m = Math.abs(row.balance_minutes % 60)
        const label = `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}`
        await notifyAdmins(tenantId, {
          title: 'Banco de horas negativo ⚠',
          body: `Um funcionário tem saldo de -${label}. Verifique no painel.`,
          url: '/admin',
          tag: `bank-low-${row.employee_id}`,
        })
        alertCount++
      }
    }
  }

  // Check long day threshold — look at today's punches
  if (settings.long_day_threshold !== null) {
    const threshold = settings.long_day_threshold

    const { data: records } = await supabase
      .from('records')
      .select('employee_id, employee_name, type, timestamp')
      .eq('tenant_id', tenantId)
      .eq('date', today)
      .order('timestamp', { ascending: true })

    const byEmp = new Map<string, { name: string; types: string[]; timestamps: string[] }>()
    for (const r of (records ?? []) as { employee_id: string; employee_name: string; type: string; timestamp: string }[]) {
      if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, { name: r.employee_name, types: [], timestamps: [] })
      byEmp.get(r.employee_id)!.types.push(r.type)
      byEmp.get(r.employee_id)!.timestamps.push(r.timestamp)
    }

    for (const [, emp] of Array.from(byEmp.entries())) {
      const entries = emp.timestamps.filter((_: string, i: number) => emp.types[i] === 'entrada')
      const exits   = emp.timestamps.filter((_: string, i: number) => emp.types[i] === 'saída')
      if (!entries.length || !exits.length) continue
      const first = new Date(entries[0]).getTime()
      const last  = new Date(exits[exits.length - 1]).getTime()
      const diffMin = Math.round((last - first) / 60_000)
      if (diffMin >= threshold) {
        const h = Math.floor(diffMin / 60)
        await notifyAdmins(tenantId, {
          title: 'Jornada longa detectada ⏰',
          body: `${emp.name} trabalhou mais de ${h}h hoje. Verifique o painel.`,
          url: '/admin',
          tag: `long-day-${today}`,
        })
        alertCount++
      }
    }
  }

  return alertCount
}

async function notifyAdmins(tenantId: string, notification: { title: string; body: string; url: string; tag: string }) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  // Only notify admins, not regular employees
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

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let totalAlerts = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    try {
      totalAlerts += await runAlertCheck(tenantId)
    } catch { failures++ }
  }
  return NextResponse.json({ alerts: totalAlerts, failures })
}
