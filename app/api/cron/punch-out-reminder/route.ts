import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate, businessMinutesOfDay } from '@/lib/utils'
import { expectedEndForDate } from '@/lib/schedule'
import { parseTimeToMinutes } from '@/lib/entryReminder'
import { activeTenantIds } from '@/lib/tenant'
import webpush from 'web-push'

// Schedule-aware (#287): the cron runs every 30 min across the evening window
// (vercel.json) and each employee is reminded around THEIR expected end — 15
// minutes before it up to 2h after — instead of one fixed time for everyone.
// The audit-log dedup keeps it to one reminder per person per day, and the UTC
// window plus per-person local logic make it DST-stable (#286).
const REMIND_BEFORE_MIN = 15
const REMIND_UNTIL_AFTER_MIN = 120
// People with no expected end configured anywhere keep the old behaviour of a
// generic evening reminder at this local time.
const DEFAULT_END = '18:30'
const ACTION = 'punch_out_reminder_sent'

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

  const now = new Date()
  const today = businessDate(now)
  const nowMinutes = businessMinutesOfDay(now)

  let notified = 0
  let failures = 0
  for (const tenantId of await activeTenantIds()) {
    try { notified += await runTenant(tenantId, today, nowMinutes) }
    catch { failures++ }
  }

  return NextResponse.json({ notified, failures })
}

async function runTenant(tenantId: string, today: string, nowMinutes: number): Promise<number> {
  // Find employees who have an entrada but no saída today
  const { data: entries } = await supabase
    .from('records')
    .select('employee_id, employee_name')
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
  const workingIds = Array.from(new Set(
    entries.filter(r => !exitedIds.has(r.employee_id)).map(r => r.employee_id)
  ))
  if (!workingIds.length) return 0

  // Their schedules decide WHEN each one is due (expected end for today).
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, workday_hours, expected_start, expected_end, weekly_schedule')
    .eq('tenant_id', tenantId)
    .in('id', workingIds)

  const due = (employees ?? []).filter(emp => {
    const end = expectedEndForDate(emp, today) ?? DEFAULT_END
    const endMin = parseTimeToMinutes(end)
    if (endMin == null) return false
    return nowMinutes >= endMin - REMIND_BEFORE_MIN && nowMinutes <= endMin + REMIND_UNTIL_AFTER_MIN
  })
  if (!due.length) return 0

  // One reminder per person per day — the cron re-runs every 30 min.
  const { data: sentLogs } = await supabase
    .from('audit_logs')
    .select('target_id')
    .eq('tenant_id', tenantId)
    .eq('action', ACTION)
    .contains('details', { date: today })
    .in('target_id', due.map(e => e.id))

  const alreadySent = new Set((sentLogs ?? []).map(l => l.target_id).filter(Boolean))
  const pending = due.filter(e => !alreadySent.has(e.id))
  if (!pending.length) return 0

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, employee_id')
    .eq('tenant_id', tenantId)
    .in('employee_id', pending.map(e => e.id))

  if (!subs?.length) return 0

  const subsByEmp = new Map<string, webpush.PushSubscription[]>()
  for (const s of subs) {
    const arr = subsByEmp.get(s.employee_id) ?? []
    arr.push(s.subscription as webpush.PushSubscription)
    subsByEmp.set(s.employee_id, arr)
  }

  let sent = 0
  const logs: Array<Record<string, unknown>> = []
  await Promise.allSettled(
    pending.map(async emp => {
      const empSubs = subsByEmp.get(emp.id)
      if (!empSubs?.length) return
      const payload = JSON.stringify({
        title: 'Não te esqueças de bater saída 🔔',
        body: 'O teu expediente está a terminar. Regista a saída para fechar o ponto.',
        url: '/ponto',
        tag: `punch-out-reminder-${today}`,
      })
      const results = await Promise.allSettled(
        empSubs.map(sub => webpush.sendNotification(sub, payload).then(() => { sent++ }))
      )
      if (results.some(r => r.status === 'fulfilled')) {
        logs.push({
          tenant_id: tenantId,
          actor_id: null,
          actor_name: 'cron:punch-out-reminder',
          action: ACTION,
          target_id: emp.id,
          target_name: emp.name,
          details: { date: today },
        })
      }
    })
  )

  if (logs.length) await supabase.from('audit_logs').insert(logs)

  return sent
}
