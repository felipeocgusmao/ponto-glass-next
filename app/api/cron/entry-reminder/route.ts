import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TZ, businessDate } from '@/lib/utils'
import { businessClockMinutes, dueEntryReminderIds, formatClock, parseTimeToMinutes } from '@/lib/entryReminder'
import { expectedStartForDate, isScheduledWorkday } from '@/lib/schedule'
import { activeTenantIds } from '@/lib/tenant'
import { recordCronRun } from '@/lib/cronHealth'
import webpush from 'web-push'

const LOOK_AHEAD_MINUTES = 60
const ACTION = 'entry_reminder_sent'

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

  const now = new Date()
  const today = businessDate(now)
  // No global weekend skip (#287): weekend workers get their reminder on the
  // days their weekly schedule marks as working; everyone else is filtered
  // per-employee by isScheduledWorkday in runTenant.

  // One pass per active tenant — each company has its own holiday calendar,
  // employees and subscriptions.
  const tenantIds = await activeTenantIds()
  await recordCronRun('entry-reminder', tenantIds)

  let notified = 0
  let due = 0
  let failures = 0
  for (const tenantId of tenantIds) {
    // One tenant erroring must not starve the remaining tenants.
    try {
      const r = await runTenant(tenantId, now, today)
      notified += r.notified
      due += r.due
    } catch { failures++ }
  }

  return NextResponse.json({ notified, due, failures })
}

async function runTenant(tenantId: string, now: Date, today: string): Promise<{ notified: number; due: number }> {
  const { data: exceptions } = await supabase
    .from('day_exceptions')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('date', today)

  // Company-wide holiday only spares people who don't work holidays (#287).
  const companyHoliday = (exceptions ?? []).some(e => !e.employee_id)
  const offIds = new Set((exceptions ?? []).map(e => e.employee_id).filter(Boolean))
  const nowMinutes = businessClockMinutes(now, BUSINESS_TZ)

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, expected_start, workday_hours, expected_end, weekly_schedule, works_holidays')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('role', 'employee')

  // Per-day expected start (#287): the weekly schedule's start for today wins,
  // falling back to the single expected_start field.
  const scheduled = (employees ?? [])
    .filter(employee =>
      isScheduledWorkday(employee, today) &&
      (!companyHoliday || employee.works_holidays === true))
    .map(employee => ({ ...employee, expected_start: expectedStartForDate(employee, today) }))
    .filter(employee => employee.expected_start != null)

  const dueIds = dueEntryReminderIds(scheduled, nowMinutes, LOOK_AHEAD_MINUTES)
  const dueEmployees = scheduled.filter(employee => dueIds.has(employee.id) && !offIds.has(employee.id))
  if (!dueEmployees.length) return { notified: 0, due: 0 }

  const ids = dueEmployees.map(employee => employee.id)
  const { data: entries } = await supabase
    .from('records')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('date', today)
    .eq('type', 'entrada')
    .in('employee_id', ids)

  const presentIds = new Set((entries ?? []).map(r => r.employee_id))
  const absentEmployees = dueEmployees.filter(employee => !presentIds.has(employee.id))
  if (!absentEmployees.length) return { notified: 0, due: dueEmployees.length }

  const absentIds = absentEmployees.map(employee => employee.id)
  const { data: sentLogs } = await supabase
    .from('audit_logs')
    .select('target_id')
    .eq('tenant_id', tenantId)
    .eq('action', ACTION)
    .contains('details', { date: today })
    .in('target_id', absentIds)

  const alreadySentIds = new Set((sentLogs ?? []).map(log => log.target_id).filter(Boolean))
  const pendingEmployees = absentEmployees.filter(employee => !alreadySentIds.has(employee.id))
  if (!pendingEmployees.length) return { notified: 0, due: dueEmployees.length }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('employee_id, subscription')
    .eq('tenant_id', tenantId)
    .in('employee_id', pendingEmployees.map(employee => employee.id))

  if (!subs?.length) return { notified: 0, due: dueEmployees.length }

  const subByEmployee = new Map(subs.map(sub => [sub.employee_id, sub.subscription]))
  let sent = 0
  const logs: Array<Record<string, unknown>> = []

  await Promise.allSettled(
    pendingEmployees.map(async employee => {
      const subscription = subByEmployee.get(employee.id)
      if (!subscription) return
      const expectedMinutes = parseTimeToMinutes(employee.expected_start)
      const expectedLabel = expectedMinutes == null ? employee.expected_start ?? 'agora' : formatClock(expectedMinutes)
      const payload = JSON.stringify({
        title: 'Hora de bater a entrada',
        body: `A tua entrada prevista é às ${expectedLabel}. Bate o ponto para começar o dia.`,
        tag: `entry-reminder-${today}-${employee.id}`,
        url: '/ponto',
      })

      try {
        await webpush.sendNotification(subscription as webpush.PushSubscription, payload)
        sent++
        logs.push({
          tenant_id: tenantId,
          actor_id: null,
          actor_name: 'cron:entry-reminder',
          action: ACTION,
          target_id: employee.id,
          target_name: employee.name,
          details: { date: today, expected_start: employee.expected_start, timezone: BUSINESS_TZ },
        })
      } catch { /* subscription may be expired or VAPID may be missing */ }
    })
  )

  if (logs.length) await supabase.from('audit_logs').insert(logs)

  return { notified: sent, due: dueEmployees.length }
}
