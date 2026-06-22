import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate, calcNetMinutes } from '@/lib/utils'
import { rateLimit } from '@/lib/rateLimit'
import { validateGeofence, isDuplicatePunch, isValidPunchType, resolvePunchTimestamp } from '@/lib/punchValidation'
import type { PunchRecord } from '@/lib/types'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

async function maybeNotifyDailyTarget(tenantId: string, empId: string, date: string, newRecord: PunchRecord) {
  try {
    const [{ data: empRow }, { data: prevRecs }] = await Promise.all([
      supabase.from('employees')
        .select('workday_hours, lunch_break_minutes')
        .eq('id', empId).maybeSingle(),
      supabase.from('records').select('*')
        .eq('tenant_id', tenantId).eq('employee_id', empId).eq('date', date)
        .order('timestamp', { ascending: true }),
    ])
    if (!empRow) return
    const targetMin = (empRow.workday_hours ?? 8) * 60
    const lunch = empRow.lunch_break_minutes ?? 60
    const recsWithout = (prevRecs ?? []).filter((r: PunchRecord) => r.id !== newRecord.id) as PunchRecord[]
    const recsWithNew = [...recsWithout, newRecord]
    const beforeMin = calcNetMinutes(recsWithout, lunch)
    const afterMin = calcNetMinutes(recsWithNew, lunch)
    if (beforeMin >= targetMin || afterMin < targetMin) return

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('tenant_id', tenantId)
      .eq('employee_id', empId)
    if (!subs?.length) return

    const h = Math.floor(targetMin / 60)
    const m = targetMin % 60
    const label = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
    const payload = JSON.stringify({
      title: 'Jornada concluída 🏁',
      body: `Concluíste a jornada de ${label} de hoje. Não te esqueças de registar a saída!`,
      tag: `daily-target-${date}`,
      url: '/ponto',
    })
    await Promise.allSettled(
      subs.map(({ subscription }) =>
        webpush.sendNotification(subscription as webpush.PushSubscription, payload).catch(() => {})
      )
    )
  } catch { /* non-critical */ }
}

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId, latitude, longitude, queuedAt } = await request.json()
  if (!isValidPunchType(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  let empId = user.id
  let empName = user.name
  let empShiftStart = '00:00'
  const onBehalf = targetId && targetId !== user.id

  // Try to read the geofencing columns; if the migration hasn't been applied (v11
  // missing in older DBs), fall back to a basic select and skip geofencing checks.
  // Every read is tenant-scoped so an admin in tenant A cannot resolve someone
  // in tenant B by guessing their id.
  async function readEmployee(id: string, requireActive: boolean) {
    let q = supabase.from('employees')
      .select('id, name, shift_start, geo_mode, workplace_lat, workplace_lng, max_distance_meters')
      .eq('tenant_id', user.tenant_id)
      .eq('id', id)
    if (requireActive) q = q.eq('active', true)
    const ext = await q.maybeSingle()
    if (ext.data) return { data: ext.data, geofenceAvailable: true }
    if (ext.error) {
      // schema-cache miss or column does not exist → retry without geofencing columns
      let q2 = supabase.from('employees')
        .select('id, name, shift_start, geo_mode')
        .eq('tenant_id', user.tenant_id)
        .eq('id', id)
      if (requireActive) q2 = q2.eq('active', true)
      const basic = await q2.maybeSingle()
      return { data: basic.data, geofenceAvailable: false }
    }
    return { data: null, geofenceAvailable: true }
  }

  if (onBehalf) {
    if (!['admin', 'manager'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: emp } = await readEmployee(targetId, true)
    if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    empId = emp.id
    empName = emp.name
    empShiftStart = emp.shift_start ?? '00:00'
  } else {
    const { data: empData, geofenceAvailable } = await readEmployee(empId, false)

    if (empData) {
      empShiftStart = empData.shift_start ?? '00:00'

      // Geofencing only when the migration is in place and the columns exist.
      // When the columns are missing we fall through to the basic geo_mode check.
      const geoCheck = geofenceAvailable
        ? validateGeofence({
            geoMode: (empData as { geo_mode?: string | null }).geo_mode as 'required' | 'optional' | 'disabled' | null,
            latitude, longitude,
            workplaceLat: (empData as { workplace_lat?: number | null }).workplace_lat,
            workplaceLng: (empData as { workplace_lng?: number | null }).workplace_lng,
            maxDistanceMeters: (empData as { max_distance_meters?: number | null }).max_distance_meters,
          })
        : validateGeofence({ geoMode: empData.geo_mode as 'required' | 'optional' | 'disabled' | null, latitude, longitude })

      if (!geoCheck.ok)
        return NextResponse.json({ error: geoCheck.error }, { status: geoCheck.status })
    }
  }

  if (!(await rateLimit(`punch:${empId}`, 10, 60_000)))
    return NextResponse.json({ error: 'Muitos registos seguidos. Aguarde um momento.' }, { status: 429 })

  // Offline punches flushed by the queue carry the original wall-clock in
  // queuedAt; file them under that instant (never for punches on behalf).
  const now = new Date()
  const punchTime = onBehalf ? now : resolvePunchTimestamp(queuedAt, now)
  // Detect when the server had to override the client-supplied timestamp (future
  // or too-old queuedAt) so the response can inform the UI.
  const timestampAdjusted = !onBehalf && queuedAt != null && punchTime === now

  const { data: lastRec } = await supabase
    .from('records').select('type, timestamp')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', empId).order('timestamp', { ascending: false }).limit(1).maybeSingle()
  if (isDuplicatePunch(lastRec?.type, lastRec?.timestamp, type, punchTime))
    return NextResponse.json({ error: 'Registo duplicado. Aguarde um momento.' }, { status: 409 })

  const workDate = calcWorkDate(punchTime, empShiftStart)
  const geoFields = (typeof latitude === 'number' && typeof longitude === 'number')
    ? { latitude, longitude } : {}

  const { data, error } = await supabase
    .from('records')
    .insert({ tenant_id: user.tenant_id, employee_id: empId, employee_name: empName, type, timestamp: punchTime.toISOString(), date: workDate, ...geoFields })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (onBehalf) await logAudit(user, 'punch_on_behalf', { id: empId, name: empName }, { type })

  // Fire-and-forget: notify the employee if today's worked hours just hit their daily target.
  if (!onBehalf && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    void maybeNotifyDailyTarget(user.tenant_id, empId, workDate, data as PunchRecord)
  }

  return NextResponse.json(timestampAdjusted ? { ...data, timestamp_adjusted: true } : data)
}
