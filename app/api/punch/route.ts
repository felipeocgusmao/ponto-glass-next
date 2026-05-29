import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate, haversineMeters } from '@/lib/utils'
import { rateLimit } from '@/lib/rateLimit'

const VALID_TYPES = ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId, latitude, longitude } = await request.json()
  if (!VALID_TYPES.includes(type))
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
      if (geofenceAvailable) {
        const e = empData as { geo_mode?: string | null; workplace_lat?: number | null; workplace_lng?: number | null; max_distance_meters?: number | null }
        const { geo_mode, workplace_lat, workplace_lng, max_distance_meters } = e
        if (
          geo_mode !== 'disabled' &&
          workplace_lat != null && workplace_lng != null && max_distance_meters != null
        ) {
          if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return NextResponse.json(
              { error: 'Localização obrigatória para este funcionário.' },
              { status: 400 }
            )
          }
          const dist = haversineMeters(latitude, longitude, workplace_lat, workplace_lng)
          if (dist > max_distance_meters) {
            return NextResponse.json(
              { error: `Fora do local de trabalho (${Math.round(dist)}m de distância, máximo ${max_distance_meters}m).` },
              { status: 400 }
            )
          }
        } else if (geo_mode === 'required') {
          if (typeof latitude !== 'number' || typeof longitude !== 'number')
            return NextResponse.json({ error: 'Localização obrigatória.' }, { status: 400 })
        }
      } else if (empData.geo_mode === 'required') {
        if (typeof latitude !== 'number' || typeof longitude !== 'number')
          return NextResponse.json({ error: 'Localização obrigatória.' }, { status: 400 })
      }
    }
  }

  if (!(await rateLimit(`punch:${empId}`, 10, 60_000)))
    return NextResponse.json({ error: 'Muitos registos seguidos. Aguarde um momento.' }, { status: 429 })

  const { data: lastRec } = await supabase
    .from('records').select('type, timestamp')
    .eq('employee_id', empId).order('timestamp', { ascending: false }).limit(1).maybeSingle()
  if (lastRec && lastRec.type === type && Date.now() - new Date(lastRec.timestamp).getTime() < 60_000)
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
