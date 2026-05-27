import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { calcWorkDate } from '@/lib/utils'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId, latitude, longitude } = await request.json()
  if (!['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe'].includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  let empId = user.id
  let empName = user.name
  let empShiftStart = '00:00'
  const onBehalf = targetId && targetId !== user.id

  if (onBehalf) {
    if (!['admin', 'manager'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: emp } = await supabase
      .from('employees')
      .select('id, name, shift_start')
      .eq('id', targetId)
      .eq('active', true)
      .single()
    if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    empId = emp.id
    empName = emp.name
    empShiftStart = emp.shift_start ?? '00:00'
  } else {
    const { data: empData } = await supabase
      .from('employees')
      .select('shift_start')
      .eq('id', empId)
      .single()
    empShiftStart = empData?.shift_start ?? '00:00'
  }

  if (!(await rateLimit(`punch:${empId}`, 10, 60_000)))
    return NextResponse.json({ error: 'Muitos registos seguidos. Aguarde um momento.' }, { status: 429 })

  // Reject an accidental duplicate (same type repeated within a minute, e.g. double-click).
  const { data: lastRec } = await supabase
    .from('records')
    .select('type, timestamp')
    .eq('employee_id', empId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastRec && lastRec.type === type && Date.now() - new Date(lastRec.timestamp).getTime() < 60_000)
    return NextResponse.json({ error: 'Registo duplicado. Aguarde um momento.' }, { status: 409 })

  const now = new Date()
  const workDate = calcWorkDate(now, empShiftStart)
  const geoFields = (typeof latitude === 'number' && typeof longitude === 'number')
    ? { latitude, longitude }
    : {}

  const { data, error } = await supabase
    .from('records')
    .insert({
      employee_id: empId,
      employee_name: empName,
      type,
      timestamp: now.toISOString(),
      date: workDate,
      ...geoFields,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (onBehalf) {
    await logAudit(user, 'punch_on_behalf', { id: empId, name: empName }, { type })
  }

  return NextResponse.json(data)
}
