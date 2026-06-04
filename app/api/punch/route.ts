import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'
import { rateLimit } from '@/lib/rateLimit'
import { validateGeofence, isDuplicatePunch, isValidPunchType } from '@/lib/punchValidation'

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId, latitude, longitude } = await request.json()
  if (!isValidPunchType(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  let empId = user.id
  let empName = user.name
  let empShiftStart = '00:00'
  const onBehalf = targetId && targetId !== user.id

  // Try to read the geofencing columns; if the migration hasn't been applied (v11
  // missing in older DBs), fall back to a basic select and skip geofencing checks.
  async function readEmployee(id: string, requireActive: boolean) {
    let q = supabase.from('employees')
      .select('id, name, shift_start, geo_mode, workplace_lat, workplace_lng, max_distance_meters')
      .eq('id', id)
    if (requireActive) q = q.eq('active', true)
    const ext = await q.maybeSingle()
    if (ext.data) return { data: ext.data, geofenceAvailable: true }
    if (ext.error) {
      // schema-cache miss or column does not exist → retry without geofencing columns
      let q2 = supabase.from('employees')
        .select('id, name, shift_start, geo_mode')
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

  const { data: lastRec } = await supabase
    .from('records').select('type, timestamp')
    .eq('employee_id', empId).order('timestamp', { ascending: false }).limit(1).maybeSingle()
  if (isDuplicatePunch(lastRec?.type, lastRec?.timestamp, type))
    return NextResponse.json({ error: 'Registo duplicado. Aguarde um momento.' }, { status: 409 })

  const now = new Date()
  const workDate = calcWorkDate(now, empShiftStart)
  const geoFields = (typeof latitude === 'number' && typeof longitude === 'number')
    ? { latitude, longitude } : {}

  const { data, error } = await supabase
    .from('records')
    .insert({ employee_id: empId, employee_name: empName, type, timestamp: now.toISOString(), date: workDate, ...geoFields })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (onBehalf) await logAudit(user, 'punch_on_behalf', { id: empId, name: empName }, { type })

  return NextResponse.json(data)
}
