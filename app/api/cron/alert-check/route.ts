import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate, businessHourOfDay, fmtMinutes } from '@/lib/utils'
import { longestContinuousWorkMin, restBetweenDaysMin } from '@/lib/schedule'
import { activeTenantIds } from '@/lib/tenant'
import { sendPendingRequestsEmail } from '@/lib/email'
import webpush from 'web-push'
import type { PunchRecord } from '@/lib/types'
import type { TenantAlertSettings } from '../../tenant-settings/route'

// Dual UTC hours in vercel.json + this guard = DST-stable local run time (#286).
const TARGET_LOCAL_HOUR = 21

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
  if (!settings.hour_bank_low_threshold && !settings.long_day_threshold && !settings.pt_compliance) return 0

  // Business-local day, not the UTC day — after 22:00/23:00 UTC they differ.
  const today = businessDate()
  let alertCount = 0

  // ── PT labour-law rest checks (#285) — evaluated once per day at 21:00 local:
  // yesterday's >5h-consecutive stretches (art. 213.º) and a daily rest under
  // 11h between yesterday's last saída and today's first entrada (art. 214.º).
  if (settings.pt_compliance) {
    const prev = new Date(`${today}T12:00:00Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    const yesterday = prev.toISOString().split('T')[0]

    const { data: recs } = await supabase
      .from('records')
      .select('employee_id, employee_name, type, timestamp, date')
      .eq('tenant_id', tenantId)
      .in('date', [yesterday, today])
      .order('timestamp', { ascending: true })

    const byEmpDay = new Map<string, { name: string; days: Map<string, PunchRecord[]> }>()
    for (const r of (recs ?? []) as PunchRecord[]) {
      if (!byEmpDay.has(r.employee_id)) byEmpDay.set(r.employee_id, { name: r.employee_name, days: new Map() })
      const days = byEmpDay.get(r.employee_id)!.days
      if (!days.has(r.date)) days.set(r.date, [])
      days.get(r.date)!.push(r)
    }

    for (const [empId, { name, days }] of Array.from(byEmpDay.entries())) {
      const yRecs = days.get(yesterday) ?? []
      const tRecs = days.get(today) ?? []

      const stretch = longestContinuousWorkMin(yRecs)
      if (stretch > 300) {
        await notifyAdmins(tenantId, {
          title: 'Mais de 5h sem pausa ⚠',
          body: `${name} trabalhou ${fmtMinutes(stretch)} seguidas ontem sem intervalo (art. 213.º CT exige pausa antes das 5h).`,
          url: '/admin',
          tag: `rest5h-${yesterday}-${empId}`,
        })
        alertCount++
      }

      const rest = restBetweenDaysMin(yRecs, tRecs)
      if (rest != null && rest < 660) {
        await notifyAdmins(tenantId, {
          title: 'Descanso diário insuficiente ⚠',
          body: `${name} teve apenas ${fmtMinutes(rest)} de descanso entre ontem e hoje (mínimo legal: 11h, art. 214.º CT).`,
          url: '/admin',
          tag: `rest11h-${today}-${empId}`,
        })
        alertCount++
      }
    }
  }

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

// Pending-requests digest (#252): emails admins when corrections/compensations
// are waiting. Runs regardless of alert_settings (unlike runAlertCheck, which
// early-returns without thresholds) — push covers admins who installed it;
// this is the safety net for the ones who didn't.
async function runPendingDigest(tenantId: string): Promise<number> {
  const [corr, comp] = await Promise.all([
    supabase.from('correction_requests').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'pending'),
    supabase.from('compensation_requests').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'pending'),
  ])
  const corrections = corr.count ?? 0
  const compensations = comp.count ?? 0
  if (corrections + compensations === 0) return 0

  const { data: admins } = await supabase
    .from('employees')
    .select('name, email')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin')
    .eq('active', true)
    .not('email', 'is', null)

  let sent = 0
  for (const admin of (admins ?? []) as { name: string; email: string }[]) {
    const ok = await sendPendingRequestsEmail({
      to: admin.email, adminName: admin.name, corrections, compensations,
    })
    if (ok) sent++
  }
  return sent
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

  if (businessHourOfDay() !== TARGET_LOCAL_HOUR)
    return NextResponse.json({ alerts: 0, digestEmails: 0, skipped: 'off-hour' })

  let totalAlerts = 0
  let digestEmails = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    try {
      totalAlerts += await runAlertCheck(tenantId)
      digestEmails += await runPendingDigest(tenantId)
    } catch { failures++ }
  }
  return NextResponse.json({ alerts: totalAlerts, digestEmails, failures })
}
